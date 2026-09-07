import json

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "vdlm-reasoning-server"


def test_ready_endpoint(client):
    response = client.get("/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["planner_ready"] is True
    assert body["model_provider"] == "mock"


def test_protocol_info(client):
    response = client.get("/v1/protocol")
    assert response.status_code == 200
    body = response.json()
    assert body["websocket_path"] == "/ws/v1/session"
    assert "latent.frame" in body["accepted_messages"]
