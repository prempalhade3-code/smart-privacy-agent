import base64

import numpy as np
import pytest

from app.security.payload_guard import PayloadRejected, scan_for_forbidden_content
from app.tensor.serialization import decode_tensor_payload, encode_tensor_for_test, contract_from_settings
from app.validation.latent_payload import ValidationFailure, validate_latent_frame, validate_session_init
from tests.conftest import (
    make_forbidden_screenshot_payload,
    make_latent_frame_payload,
    make_sanitized_tensor,
    make_session_init_payload,
    make_test_settings,
)


def test_reject_forbidden_screenshot_field():
    with pytest.raises(PayloadRejected) as exc:
        scan_for_forbidden_content(make_forbidden_screenshot_payload())
    assert exc.value.code == "FORBIDDEN_FIELD"


def test_reject_png_data_uri():
    with pytest.raises(PayloadRejected):
        scan_for_forbidden_content({"data": "data:image/png;base64,abc"})


def test_validate_session_init_success():
    settings = make_test_settings()
    payload = validate_session_init(make_session_init_payload(), settings)
    assert "submit" in payload.task_intent


def test_validate_session_init_wrong_patch_count():
    settings = make_test_settings()
    raw = make_session_init_payload()
    raw["encoder_spec"]["patch_count"] = 100
    with pytest.raises(ValidationFailure) as exc:
        validate_session_init(raw, settings)
    assert exc.value.code == "ENCODER_SPEC_MISMATCH"


def test_decode_tensor_roundtrip():
    settings = make_test_settings()
    contract = contract_from_settings(settings)
    tensor = make_sanitized_tensor()
    encoded = encode_tensor_for_test(tensor)
    decoded = decode_tensor_payload(encoded, contract, settings.vdlm_max_tensor_elements)
    assert decoded.shape == tensor.shape


def test_decode_tensor_shape_mismatch():
    settings = make_test_settings()
    contract = contract_from_settings(settings)
    encoded = encode_tensor_for_test(make_sanitized_tensor())
    encoded.shape = [100, 1152]
    with pytest.raises(PayloadRejected) as exc:
        decode_tensor_payload(encoded, contract, settings.vdlm_max_tensor_elements)
    assert exc.value.code == "TENSOR_SHAPE_MISMATCH"


def test_validate_latent_frame_invalid_patch_index():
    settings = make_test_settings()
    raw = make_latent_frame_payload()
    raw["spatial_metadata"]["sensitive_patch_indices"] = [9999]
    with pytest.raises(ValidationFailure) as exc:
        validate_latent_frame(raw, settings)
    assert exc.value.code == "INVALID_PATCH_INDEX"
