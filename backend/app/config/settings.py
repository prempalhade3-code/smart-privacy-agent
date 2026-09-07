from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    vdlm_host: str = "0.0.0.0"
    vdlm_port: int = 8080
    vdlm_log_level: str = "INFO"

    vdlm_model_provider: str = "mock"
    vdlm_llama_base_url: str = "http://127.0.0.1:8000/v1"
    vdlm_llama_model: str = "meta-llama/Meta-Llama-3-70B-Instruct"
    vdlm_llama_api_key: str = ""
    vdlm_llama_timeout_seconds: float = 60.0

    # Production clients target <45 KB compact latent payloads (blueprint).
    # Default wire limit is higher so dev/integration tests can send full SigLIP tensors.
    vdlm_max_payload_bytes: int = 2_097_152
    vdlm_compact_payload_target_bytes: int = 45_056
    vdlm_max_tensor_elements: int = 663552  # 576 * 1152
    vdlm_session_ttl_seconds: int = 3600

    vdlm_patch_count: int = 576
    vdlm_embedding_dim: int = 1152

    protocol_version: str = "1.0"


@lru_cache
def get_settings() -> Settings:
    return Settings()
