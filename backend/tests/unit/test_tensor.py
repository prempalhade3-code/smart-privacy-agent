import base64
import zlib

import numpy as np
import pytest

from app.config.settings import Settings
from app.tensor.serialization import TensorPayload, contract_from_settings, decode_tensor_payload
from tests.conftest import make_sanitized_tensor, make_test_settings


def test_zlib_compressed_tensor_roundtrip():
    settings = make_test_settings()
    contract = contract_from_settings(settings)
    tensor = make_sanitized_tensor()
    raw = tensor.numpy().astype(np.float16).tobytes()
    compressed = zlib.compress(raw)

    payload = TensorPayload(
        dtype="float16",
        shape=[576, 1152],
        data=base64.b64encode(compressed).decode("ascii"),
        compression="zlib",
    )
    decoded = decode_tensor_payload(payload, contract, settings.vdlm_max_tensor_elements)
    assert decoded.shape == (576, 1152)
