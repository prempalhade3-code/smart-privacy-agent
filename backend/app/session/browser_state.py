import time
import uuid
from dataclasses import dataclass, field

from app.schemas.messages import ActionResultPayload, EncoderSpec, Viewport


@dataclass
class BrowserSession:
    session_id: str
    task_intent: str
    encoder_spec: EncoderSpec
    viewport: Viewport
    client_capabilities: list[str]
    created_at: float
    last_seen_at: float
    state_version: int = 0
    last_frame_id: str | None = None
    last_action_id: str | None = None
    frames_processed: int = 0
    pending_state_version: int | None = None


@dataclass
class SessionStore:
    sessions: dict[str, BrowserSession] = field(default_factory=dict)
    ttl_seconds: int = 3600

    def create(
        self,
        task_intent: str,
        encoder_spec: EncoderSpec,
        viewport: Viewport,
        client_capabilities: list[str],
    ) -> BrowserSession:
        now = time.time()
        session = BrowserSession(
            session_id=str(uuid.uuid4()),
            task_intent=task_intent,
            encoder_spec=encoder_spec,
            viewport=viewport,
            client_capabilities=client_capabilities,
            created_at=now,
            last_seen_at=now,
        )
        self.sessions[session.session_id] = session
        return session

    def get(self, session_id: str) -> BrowserSession | None:
        self.evict_expired()
        session = self.sessions.get(session_id)
        if session:
            session.last_seen_at = time.time()
        return session

    def update_state_version(self, session_id: str, state_version: int) -> None:
        session = self.get(session_id)
        if session:
            session.state_version = state_version
            session.pending_state_version = None

    def record_frame(
        self,
        session_id: str,
        frame_id: str,
        state_version: int,
    ) -> tuple[bool, int | None]:
        """Returns (is_stale, expected_version)."""
        session = self.get(session_id)
        if not session:
            return False, None

        session.last_frame_id = frame_id
        session.frames_processed += 1

        if session.pending_state_version is not None:
            if state_version != session.pending_state_version:
                return True, session.pending_state_version
        elif session.state_version > 0 and state_version < session.state_version:
            return True, session.state_version

        session.state_version = state_version
        return False, None

    def record_action_result(self, session_id: str, result: ActionResultPayload) -> None:
        session = self.get(session_id)
        if not session:
            return
        session.last_action_id = result.action_id
        session.state_version = result.state_version
        session.pending_state_version = None

    def mark_pending_plan(self, session_id: str, state_version: int) -> None:
        session = self.get(session_id)
        if session:
            session.pending_state_version = state_version

    def evict_expired(self) -> None:
        now = time.time()
        expired = [
            sid
            for sid, s in self.sessions.items()
            if now - s.last_seen_at > self.ttl_seconds
        ]
        for sid in expired:
            del self.sessions[sid]

    def count(self) -> int:
        self.evict_expired()
        return len(self.sessions)
