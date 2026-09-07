import re
from typing import Any

FORBIDDEN_FIELD_PATTERN = re.compile(
    r"(screenshot|raw_pixels?|image_data|dom_html|password|credential|"
    r"payment_info|accessibility_tree|png|jpeg|jpg|webp|canvas_blob)",
    re.IGNORECASE,
)

FORBIDDEN_VALUE_PATTERNS = (
    re.compile(r"^data:image/", re.IGNORECASE),
    re.compile(r"iVBORw0KGgo", re.IGNORECASE),  # PNG header in base64
)


class PayloadRejected(Exception):
    def __init__(self, code: str, message: str, recoverable: bool = False):
        self.code = code
        self.message = message
        self.recoverable = recoverable
        super().__init__(message)


def scan_for_forbidden_content(obj: Any, path: str = "") -> None:
    """Recursively reject payloads that may carry raw private visual content."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            key_path = f"{path}.{key}" if path else key
            if FORBIDDEN_FIELD_PATTERN.search(str(key)):
                raise PayloadRejected(
                    "FORBIDDEN_FIELD",
                    f"Forbidden field: {key}",
                    recoverable=False,
                )
            scan_for_forbidden_content(value, key_path)
    elif isinstance(obj, list):
        for index, item in enumerate(obj):
            scan_for_forbidden_content(item, f"{path}[{index}]")
    elif isinstance(obj, str):
        if path.endswith(".data") and "tensor" in path:
            return
        if len(obj) > 500_000:
            raise PayloadRejected(
                "PAYLOAD_TOO_LARGE",
                f"String field too large at {path or 'root'}",
                recoverable=False,
            )
        for pattern in FORBIDDEN_VALUE_PATTERNS:
            if pattern.search(obj):
                raise PayloadRejected(
                    "FORBIDDEN_CONTENT",
                    f"Forbidden content pattern at {path or 'root'}",
                    recoverable=False,
                )


def enforce_payload_size(raw_bytes: int, max_bytes: int) -> None:
    if raw_bytes > max_bytes:
        raise PayloadRejected(
            "PAYLOAD_TOO_LARGE",
            f"Payload size {raw_bytes} exceeds limit {max_bytes}",
            recoverable=False,
        )
