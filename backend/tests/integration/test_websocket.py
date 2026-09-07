import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.transport.websocket.protocol import build_message
from tests.conftest import (
    make_forbidden_screenshot_payload,
    make_latent_frame_payload,
    make_session_init_payload,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_websocket_session_init_and_latent_frame(client):
    with client.websocket_connect("/ws/v1/session") as ws:
        ws.send_text(
            json.dumps(
                build_message("session.init", make_session_init_payload())
            )
        )
        ready = json.loads(ws.receive_text())
        assert ready["type"] == "session.ready"
        session_id = ready["payload"]["session_id"]

        ws.send_text(
            json.dumps(
                build_message(
                    "latent.frame",
                    make_latent_frame_payload(),
                    session_id=session_id,
                )
            )
        )
        directive = json.loads(ws.receive_text())
        assert directive["type"] == "action.directive"
        assert directive["payload"]["action"] == "CLICK"
        assert directive["payload"]["coords"] is not None
        assert len(directive["payload"]["coords"]) == 2


def test_websocket_rejects_forbidden_screenshot(client):
    with client.websocket_connect("/ws/v1/session") as ws:
        ws.send_text(
            json.dumps(
                build_message("session.init", make_session_init_payload())
            )
        )
        ready = json.loads(ws.receive_text())
        session_id = ready["payload"]["session_id"]

        ws.send_text(
            json.dumps(
                build_message(
                    "latent.frame",
                    make_forbidden_screenshot_payload(),
                    session_id=session_id,
                )
            )
        )
        error = json.loads(ws.receive_text())
        assert error["type"] == "error"
        assert error["payload"]["code"] == "FORBIDDEN_FIELD"


def test_websocket_stale_plan_detection(client):
    with client.websocket_connect("/ws/v1/session") as ws:
        ws.send_text(
            json.dumps(
                build_message("session.init", make_session_init_payload())
            )
        )
        ready = json.loads(ws.receive_text())
        session_id = ready["payload"]["session_id"]

        ws.send_text(
            json.dumps(
                build_message(
                    "latent.frame",
                    make_latent_frame_payload(state_version=5),
                    session_id=session_id,
                )
            )
        )
        json.loads(ws.receive_text())  # action.directive

        ws.send_text(
            json.dumps(
                build_message(
                    "latent.frame",
                    make_latent_frame_payload(state_version=3, frame_id="f-00002"),
                    session_id=session_id,
                )
            )
        )
        stale = json.loads(ws.receive_text())
        assert stale["type"] == "plan.stale"
        assert stale["payload"]["reason"] == "state_version_mismatch"
