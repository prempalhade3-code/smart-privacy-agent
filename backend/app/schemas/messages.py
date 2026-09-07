from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class ActionType(str, Enum):
    CLICK = "CLICK"
    SCROLL = "SCROLL"
    TYPE = "TYPE"
    WAIT = "WAIT"
    NAVIGATE = "NAVIGATE"
    DONE = "DONE"


class EncoderSpec(BaseModel):
    model_id: str = "siglip-base-patch16-224"
    patch_count: int = 576
    embedding_dim: int = 1152
    dtype: Literal["float16", "float32"] = "float16"


class Viewport(BaseModel):
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class PatchGrid(BaseModel):
    rows: int = Field(gt=0)
    cols: int = Field(gt=0)


class SpatialMetadata(BaseModel):
    patch_grid: PatchGrid
    sensitive_patch_indices: list[int] = Field(default_factory=list)
    viewport_hash: str | None = None


class ActionContext(BaseModel):
    last_action_id: str | None = None
    pending_user_input: bool = False


class SanitizationProvenance(BaseModel):
    """Extension point for GAP 5 cryptographic verification (future)."""

    vdlm_shader_version: str | None = None
    sanitization_method: str = "null_space_projection"
    attestation: str | None = None
    attestation_scheme: str | None = None


class TensorPayload(BaseModel):
    encoding: Literal["base64"] = "base64"
    dtype: Literal["float16", "float32"] = "float16"
    shape: list[int]
    data: str
    compression: Literal["none", "zlib", "delta"] = "none"
    delta_base_frame_id: str | None = None

    @field_validator("shape")
    @classmethod
    def shape_must_be_2d(cls, value: list[int]) -> list[int]:
        if len(value) != 2:
            raise ValueError("tensor shape must be 2-dimensional [patches, embedding_dim]")
        return value


class LatentFramePayload(BaseModel):
    frame_id: str
    state_version: int = Field(ge=0)
    tensor: TensorPayload
    spatial_metadata: SpatialMetadata
    action_context: ActionContext = Field(default_factory=ActionContext)
    provenance: SanitizationProvenance = Field(default_factory=SanitizationProvenance)


class SessionInitPayload(BaseModel):
    task_intent: str = Field(min_length=1, max_length=4096)
    encoder_spec: EncoderSpec = Field(default_factory=EncoderSpec)
    viewport: Viewport
    client_capabilities: list[str] = Field(default_factory=list)


class ActionResultPayload(BaseModel):
    action_id: str
    state_version: int = Field(ge=0)
    status: Literal["success", "failure", "cancelled"]
    error_code: str | None = None


class ActionDirectivePayload(BaseModel):
    action_id: str
    action: ActionType
    target_id: int | None = None
    coords: list[float] | None = None
    text: str | None = None
    scroll_delta: list[float] | None = None
    state_version_required: int
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning_summary: str = ""

    @field_validator("coords")
    @classmethod
    def normalize_coords(cls, value: list[float] | None) -> list[float] | None:
        if value is None:
            return value
        if len(value) != 2:
            raise ValueError("coords must be [x, y]")
        for component in value:
            if not 0.0 <= component <= 1.0:
                raise ValueError("coords must be normalized to [0, 1]")
        return value


class SessionReadyPayload(BaseModel):
    session_id: str
    server_time_ms: int
    accepted_encoder_spec: EncoderSpec


class PlanStalePayload(BaseModel):
    expected_state_version: int
    received_state_version: int
    reason: str


class ErrorPayload(BaseModel):
    code: str
    message: str
    recoverable: bool = False
    details: dict[str, Any] | None = None


class WireMessage(BaseModel):
    type: str
    protocol_version: str = "1.0"
    session_id: str | None = None
    timestamp_ms: int | None = None
    payload: dict[str, Any]
