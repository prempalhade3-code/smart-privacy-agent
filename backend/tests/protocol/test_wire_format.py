import json

from app.transport.websocket.protocol import build_message, parse_message, serialize_message
from tests.conftest import make_latent_frame_payload, make_session_init_payload


def test_wire_message_roundtrip():
    msg = build_message("session.init", make_session_init_payload())
    serialized = serialize_message(msg)
    parsed = parse_message(serialized)
    assert parsed["type"] == "session.init"
    assert parsed["protocol_version"] == "1.0"


def test_latent_frame_message_structure():
    msg = build_message("latent.frame", make_latent_frame_payload(), session_id="test-session")
    assert msg["session_id"] == "test-session"
    assert "tensor" in msg["payload"]
    assert msg["payload"]["tensor"]["shape"] == [576, 1152]
