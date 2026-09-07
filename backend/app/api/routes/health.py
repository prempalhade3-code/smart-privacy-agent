from fastapi import APIRouter

from app import __version__
from app.config.settings import get_settings
from app.models.provider import get_planner
from app.transport.websocket.handler import WebSocketSessionHandler

router = APIRouter()
_handler = WebSocketSessionHandler()


@router.get("/health")
async def health():
    return {
        "service": "vdlm-reasoning-server",
        "status": "ok",
        "version": __version__,
        "protocol_version": get_settings().protocol_version,
    }


@router.get("/ready")
async def ready():
    settings = get_settings()
    planner_ready = await get_planner().health_check()
    return {
        "service": "vdlm-reasoning-server",
        "status": "ready" if planner_ready else "degraded",
        "model_provider": settings.vdlm_model_provider,
        "planner_ready": planner_ready,
        "active_sessions": _handler.session_store.count(),
        "tensor_contract": {
            "patch_count": settings.vdlm_patch_count,
            "embedding_dim": settings.vdlm_embedding_dim,
        },
    }


@router.get("/v1/protocol")
async def protocol_info():
    settings = get_settings()
    return {
        "protocol_version": settings.protocol_version,
        "websocket_path": "/ws/v1/session",
        "accepted_messages": [
            "session.init",
            "latent.frame",
            "action.result",
        ],
        "emitted_messages": [
            "session.ready",
            "action.directive",
            "plan.stale",
            "error",
        ],
        "forbidden_inputs": [
            "screenshot",
            "raw_pixels",
            "dom_html",
            "credentials",
        ],
        "tensor_contract": {
            "model_id": "siglip-base-patch16-224",
            "shape": [settings.vdlm_patch_count, settings.vdlm_embedding_dim],
            "dtype": "float16",
        },
    }
