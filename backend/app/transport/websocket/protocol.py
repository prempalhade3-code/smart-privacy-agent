import json
import time
from typing import Any

from app.schemas.messages import WireMessage


def build_message(
    msg_type: str,
    payload: dict[str, Any],
    *,
    session_id: str | None = None,
    protocol_version: str = "1.0",
) -> dict[str, Any]:
    return WireMessage(
        type=msg_type,
        protocol_version=protocol_version,
        session_id=session_id,
        timestamp_ms=int(time.time() * 1000),
        payload=payload,
    ).model_dump(exclude_none=True)


def serialize_message(message: dict[str, Any]) -> str:
    return json.dumps(message)


def parse_message(raw: str) -> dict[str, Any]:
    data = json.loads(raw)
    if not isinstance(data, dict) or "type" not in data:
        raise ValueError("Invalid wire message: missing type")
    return data
