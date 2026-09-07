import base64
import zlib
from dataclasses import dataclass

import numpy as np
import torch

from app.config.settings import Settings
from app.schemas.messages import TensorPayload
from app.security.payload_guard import PayloadRejected


@dataclass(frozen=True)
class TensorContract:
    patch_count: int
    embedding_dim: int
    dtype: str

    @property
    def shape(self) -> tuple[int, int]:
        return (self.patch_count, self.embedding_dim)

    @property
    def element_count(self) -> int:
        return self.patch_count * self.embedding_dim


def contract_from_settings(settings: Settings) -> TensorContract:
    return TensorContract(
        patch_count=settings.vdlm_patch_count,
        embedding_dim=settings.vdlm_embedding_dim,
        dtype="float16",
    )


def decode_tensor_payload(
    payload: TensorPayload,
    contract: TensorContract,
    max_elements: int,
) -> torch.Tensor:
    expected_shape = list(contract.shape)
    if payload.shape != expected_shape:
        raise PayloadRejected(
            "TENSOR_SHAPE_MISMATCH",
            f"Expected shape {expected_shape}, got {payload.shape}",
        )

    element_count = payload.shape[0] * payload.shape[1]
    if element_count > max_elements:
        raise PayloadRejected(
            "TENSOR_TOO_LARGE",
            f"Tensor element count {element_count} exceeds limit {max_elements}",
        )

    try:
        raw = base64.b64decode(payload.data, validate=True)
    except Exception as exc:
        raise PayloadRejected(
            "TENSOR_DECODE_ERROR",
            f"Invalid base64 tensor data: {exc}",
        ) from exc

    if payload.compression == "zlib":
        try:
            raw = zlib.decompress(raw)
        except zlib.error as exc:
            raise PayloadRejected(
                "TENSOR_DECODE_ERROR",
                f"zlib decompression failed: {exc}",
            ) from exc

    np_dtype = np.float16 if payload.dtype == "float16" else np.float32
    expected_bytes = element_count * np.dtype(np_dtype).itemsize
    if len(raw) != expected_bytes:
        raise PayloadRejected(
            "TENSOR_SIZE_MISMATCH",
            f"Expected {expected_bytes} bytes for {payload.dtype} tensor, got {len(raw)}",
        )

    array = np.frombuffer(raw, dtype=np_dtype).reshape(payload.shape)
    if not np.isfinite(array).all():
        raise PayloadRejected(
            "TENSOR_INVALID_VALUES",
            "Tensor contains non-finite values",
        )

    return torch.from_numpy(array.copy())


def encode_tensor_for_test(tensor: torch.Tensor) -> TensorPayload:
    array = tensor.detach().cpu().numpy().astype(np.float16)
    raw = array.tobytes()
    return TensorPayload(
        dtype="float16",
        shape=list(array.shape),
        data=base64.b64encode(raw).decode("ascii"),
        compression="none",
    )
