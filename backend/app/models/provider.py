from functools import lru_cache

from app.config.settings import Settings, get_settings
from app.models.base import ActionPlanner
from app.models.llama_planner import LlamaActionPlanner
from app.models.mock_planner import MockActionPlanner


def create_planner(settings: Settings | None = None) -> ActionPlanner:
    settings = settings or get_settings()
    provider = settings.vdlm_model_provider.lower().strip()
    if provider == "mock":
        return MockActionPlanner()
    if provider in ("llama", "llama3", "llama-3"):
        return LlamaActionPlanner(settings)
    raise ValueError(
        f"Unknown VDLM_MODEL_PROVIDER: {provider!r}. Use 'mock' or 'llama'."
    )


@lru_cache
def get_planner() -> ActionPlanner:
    return create_planner(get_settings())
