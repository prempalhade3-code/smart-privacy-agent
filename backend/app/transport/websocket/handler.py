import json

from fastapi import WebSocket

from app.config.settings import Settings, get_settings
from app.models.provider import get_planner
from app.observability.logging import get_logger
from app.planning.pipeline import ActionPlanningPipeline
from app.schemas.messages import (
    ActionDirectivePayload,
    EncoderSpec,
    PlanStalePayload,
    SessionReadyPayload,
)
from app.security.payload_guard import PayloadRejected, enforce_payload_size, scan_for_forbidden_content
from app.session.browser_state import SessionStore
from app.tensor.serialization import contract_from_settings, decode_tensor_payload
from app.transport.websocket.protocol import build_message, parse_message
from app.validation.latent_payload import (
    ValidationFailure,
    validate_action_result,
    validate_latent_frame,
    validate_session_init,
)

logger = get_logger(__name__)


class WebSocketSessionHandler:
    def __init__(
        self,
        settings: Settings | None = None,
        session_store: SessionStore | None = None,
        pipeline: ActionPlanningPipeline | None = None,
    ):
        self._settings = settings or get_settings()
        self._sessions = session_store or SessionStore(
            ttl_seconds=self._settings.vdlm_session_ttl_seconds
        )
        self._pipeline = pipeline or ActionPlanningPipeline(get_planner())
        self._contract = contract_from_settings(self._settings)

    @property
    def session_store(self) -> SessionStore:
        return self._sessions

    async def handle(self, websocket: WebSocket) -> None:
        await websocket.accept()
        bound_session_id: str | None = None

        try:
            while True:
                raw = await websocket.receive_text()
                try:
                    wire_size = len(raw.encode("utf-8"))
                    enforce_payload_size(
                        wire_size,
                        self._settings.vdlm_max_payload_bytes,
                    )
                    if wire_size > self._settings.vdlm_compact_payload_target_bytes:
                        logger.warning(
                            "compact_payload_target_exceeded",
                            wire_bytes=wire_size,
                            target_bytes=self._settings.vdlm_compact_payload_target_bytes,
                        )
                    message = parse_message(raw)
                    scan_for_forbidden_content(message)
                except PayloadRejected as exc:
                    await self._send_error(
                        websocket,
                        exc.code,
                        exc.message,
                        session_id=bound_session_id,
                        recoverable=exc.recoverable,
                    )
                    continue

                msg_type = message["type"]
                payload = message.get("payload", {})

                if msg_type == "session.init":
                    session_id = await self._handle_session_init(websocket, payload)
                    if session_id:
                        bound_session_id = session_id
                    continue

                session_id = message.get("session_id") or bound_session_id
                if not session_id:
                    await self._send_error(
                        websocket,
                        "SESSION_REQUIRED",
                        "session_id required after session.init",
                    )
                    continue

                if msg_type == "latent.frame":
                    await self._handle_latent_frame(websocket, session_id, payload)
                elif msg_type == "action.result":
                    await self._handle_action_result(websocket, session_id, payload)
                else:
                    await self._send_error(
                        websocket,
                        "UNKNOWN_MESSAGE_TYPE",
                        f"Unsupported message type: {msg_type}",
                        session_id=session_id,
                    )
        except Exception as exc:
            logger.exception("websocket_session_error", error=str(exc))
            try:
                await self._send_error(
                    websocket,
                    "INTERNAL_ERROR",
                    "Internal server error",
                    session_id=bound_session_id,
                )
            except Exception:
                pass

    async def _handle_session_init(self, websocket: WebSocket, payload: dict) -> str | None:
        try:
            init = validate_session_init(payload, self._settings)
        except (ValidationFailure, PayloadRejected) as exc:
            await self._send_error(websocket, exc.code, exc.message)
            return None

        session = self._sessions.create(
            task_intent=init.task_intent,
            encoder_spec=init.encoder_spec,
            viewport=init.viewport,
            client_capabilities=init.client_capabilities,
        )

        ready = SessionReadyPayload(
            session_id=session.session_id,
            server_time_ms=int(__import__("time").time() * 1000),
            accepted_encoder_spec=EncoderSpec(
                patch_count=self._settings.vdlm_patch_count,
                embedding_dim=self._settings.vdlm_embedding_dim,
            ),
        )
        await websocket.send_text(
            json.dumps(
                build_message(
                    "session.ready",
                    ready.model_dump(),
                    session_id=session.session_id,
                    protocol_version=self._settings.protocol_version,
                )
            )
        )
        logger.info("session_initialized", session_id=session.session_id)
        return session.session_id

    async def _handle_latent_frame(
        self,
        websocket: WebSocket,
        session_id: str,
        payload: dict,
    ) -> None:
        session = self._sessions.get(session_id)
        if not session:
            await self._send_error(
                websocket,
                "SESSION_NOT_FOUND",
                f"Unknown session: {session_id}",
                session_id=session_id,
            )
            return

        try:
            frame = validate_latent_frame(payload, self._settings)
            tensor = decode_tensor_payload(
                frame.tensor,
                self._contract,
                self._settings.vdlm_max_tensor_elements,
            )
        except (ValidationFailure, PayloadRejected) as exc:
            await self._send_error(websocket, exc.code, exc.message, session_id)
            return

        is_stale, expected_version = self._sessions.record_frame(
            session_id, frame.frame_id, frame.state_version
        )
        if is_stale and expected_version is not None:
            stale = PlanStalePayload(
                expected_state_version=expected_version,
                received_state_version=frame.state_version,
                reason="state_version_mismatch",
            )
            await websocket.send_text(
                json.dumps(
                    build_message(
                        "plan.stale",
                        stale.model_dump(),
                        session_id=session_id,
                        protocol_version=self._settings.protocol_version,
                    )
                )
            )
            return

        context = self._pipeline.build_context(session, frame, tensor)
        directive = await self._pipeline.plan(context)
        self._sessions.mark_pending_plan(session_id, frame.state_version)
        await self._send_directive(websocket, session_id, directive)
        logger.info(
            "action_planned",
            session_id=session_id,
            frame_id=frame.frame_id,
            action=directive.action.value,
        )

    async def _handle_action_result(
        self,
        websocket: WebSocket,
        session_id: str,
        payload: dict,
    ) -> None:
        try:
            result = validate_action_result(payload)
        except ValidationFailure as exc:
            await self._send_error(websocket, exc.code, exc.message, session_id)
            return

        self._sessions.record_action_result(session_id, result)
        logger.info(
            "action_result_recorded",
            session_id=session_id,
            action_id=result.action_id,
            status=result.status,
        )

    async def _send_directive(
        self,
        websocket: WebSocket,
        session_id: str,
        directive: ActionDirectivePayload,
    ) -> None:
        await websocket.send_text(
            json.dumps(
                build_message(
                    "action.directive",
                    directive.model_dump(),
                    session_id=session_id,
                    protocol_version=self._settings.protocol_version,
                )
            )
        )

    async def _send_error(
        self,
        websocket: WebSocket,
        code: str,
        message: str,
        session_id: str | None = None,
        recoverable: bool = False,
    ) -> None:
        await websocket.send_text(
            json.dumps(
                build_message(
                    "error",
                    {
                        "code": code,
                        "message": message,
                        "recoverable": recoverable,
                    },
                    session_id=session_id,
                    protocol_version=self._settings.protocol_version,
                )
            )
        )
