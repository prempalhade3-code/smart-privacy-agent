from pydantic import ValidationError

from app.config.settings import Settings
from app.schemas.messages import (
    ActionResultPayload,
    EncoderSpec,
    LatentFramePayload,
    SessionInitPayload,
)
from app.security.payload_guard import PayloadRejected, scan_for_forbidden_content


class ValidationFailure(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def validate_session_init(raw: dict, settings: Settings) -> SessionInitPayload:
    scan_for_forbidden_content(raw)
    try:
        payload = SessionInitPayload.model_validate(raw)
    except ValidationError as exc:
        raise ValidationFailure("INVALID_SESSION_INIT", str(exc)) from exc

    if payload.encoder_spec.patch_count != settings.vdlm_patch_count:
        raise ValidationFailure(
            "ENCODER_SPEC_MISMATCH",
            f"patch_count must be {settings.vdlm_patch_count}",
        )
    if payload.encoder_spec.embedding_dim != settings.vdlm_embedding_dim:
        raise ValidationFailure(
            "ENCODER_SPEC_MISMATCH",
            f"embedding_dim must be {settings.vdlm_embedding_dim}",
        )
    return payload


def validate_latent_frame(raw: dict, settings: Settings) -> LatentFramePayload:
    scan_for_forbidden_content(raw)
    try:
        payload = LatentFramePayload.model_validate(raw)
    except ValidationError as exc:
        raise ValidationFailure("INVALID_LATENT_FRAME", str(exc)) from exc

    expected_patches = settings.vdlm_patch_count
    grid = payload.spatial_metadata.patch_grid
    if grid.rows * grid.cols != expected_patches:
        raise ValidationFailure(
            "PATCH_GRID_MISMATCH",
            f"patch_grid rows*cols must equal {expected_patches}",
        )

    for index in payload.spatial_metadata.sensitive_patch_indices:
        if index < 0 or index >= expected_patches:
            raise ValidationFailure(
                "INVALID_PATCH_INDEX",
                f"sensitive_patch_index {index} out of range [0, {expected_patches})",
            )

    return payload


def validate_action_result(raw: dict) -> ActionResultPayload:
    scan_for_forbidden_content(raw)
    try:
        return ActionResultPayload.model_validate(raw)
    except ValidationError as exc:
        raise ValidationFailure("INVALID_ACTION_RESULT", str(exc)) from exc


def validate_encoder_spec(spec: EncoderSpec, settings: Settings) -> None:
    if spec.patch_count != settings.vdlm_patch_count:
        raise PayloadRejected(
            "ENCODER_SPEC_MISMATCH",
            f"Unsupported patch_count: {spec.patch_count}",
        )
    if spec.embedding_dim != settings.vdlm_embedding_dim:
        raise PayloadRejected(
            "ENCODER_SPEC_MISMATCH",
            f"Unsupported embedding_dim: {spec.embedding_dim}",
        )
