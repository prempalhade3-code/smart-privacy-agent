from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket

from app import __version__
from app.api.routes.health import router as health_router
from app.config.settings import get_settings
from app.observability.logging import configure_logging, get_logger
from app.transport.websocket.handler import WebSocketSessionHandler

logger = get_logger(__name__)
_ws_handler = WebSocketSessionHandler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.vdlm_log_level)
    logger.info(
        "vdlm_server_starting",
        version=__version__,
        model_provider=settings.vdlm_model_provider,
    )
    yield
    logger.info("vdlm_server_stopping")


app = FastAPI(
    title="VDLM Cloud Reasoning Server",
    description=(
        "Privacy-preserving browser agent reasoning server for ISRO Problem 26171. "
        "Accepts sanitized latent tensors only — never raw screenshots."
    ),
    version=__version__,
    lifespan=lifespan,
)

app.include_router(health_router)


@app.websocket("/ws/v1/session")
async def websocket_session(websocket: WebSocket):
    await _ws_handler.handle(websocket)
