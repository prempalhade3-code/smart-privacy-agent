"""Shared test fixtures for VDLM backend."""

import base64

import numpy as np
import torch

from app.config.settings import Settings
from app.schemas.messages import (
    ActionContext,
    EncoderSpec,
    LatentFramePayload,
    PatchGrid,
    SessionInitPayload,
    SpatialMetadata,
    TensorPayload,
    Viewport,
)
from app.tensor.serialization import encode_tensor_for_test


def make_test_settings(**overrides) -> Settings:
    defaults = {
        "vdlm_model_provider": "mock",
        "vdlm_patch_count": 576,
        "vdlm_embedding_dim": 1152,
        "vdlm_max_payload_bytes": 2_097_152,
        "vdlm_max_tensor_elements": 663552,
    }
    defaults.update(overrides)
    return Settings(**defaults)


def make_sanitized_tensor(
    patch_count: int = 576,
    embedding_dim: int = 1152,
    seed: int = 42,
) -> torch.Tensor:
    rng = np.random.default_rng(seed)
    array = rng.standard_normal((patch_count, embedding_dim)).astype(np.float16)
    # Simulate peak activation at patch 100 (row 4, col 4 in 24x24 grid)
    array[100] *= 3.0
    return torch.from_numpy(array)


def make_latent_frame_payload(
    tensor: torch.Tensor | None = None,
    *,
    frame_id: str = "f-00001",
    state_version: int = 1,
    sensitive_indices: list[int] | None = None,
) -> dict:
    if tensor is None:
        tensor = make_sanitized_tensor()
    encoded = encode_tensor_for_test(tensor)
    payload = LatentFramePayload(
        frame_id=frame_id,
        state_version=state_version,
        tensor=encoded,
        spatial_metadata=SpatialMetadata(
            patch_grid=PatchGrid(rows=24, cols=24),
            sensitive_patch_indices=sensitive_indices or [12, 45, 100],
            viewport_hash="sha256:abc123",
        ),
        action_context=ActionContext(),
    )
    return payload.model_dump()


def make_session_init_payload(task_intent: str = "Click the submit button") -> dict:
    return SessionInitPayload(
        task_intent=task_intent,
        encoder_spec=EncoderSpec(),
        viewport=Viewport(width=1920, height=1080),
        client_capabilities=["webgpu", "onnx-runtime-web"],
    ).model_dump()


def make_forbidden_screenshot_payload() -> dict:
    frame = make_latent_frame_payload()
    frame["screenshot"] = base64.b64encode(b"fake-image").decode("ascii")
    return frame
