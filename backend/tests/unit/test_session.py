from app.session.browser_state import SessionStore
from app.schemas.messages import ActionResultPayload, EncoderSpec, Viewport


def test_session_state_version_stale_detection():
    store = SessionStore(ttl_seconds=3600)
    session = store.create(
        task_intent="test",
        encoder_spec=EncoderSpec(),
        viewport=Viewport(width=800, height=600),
        client_capabilities=[],
    )
    store.record_frame(session.session_id, "f-1", state_version=5)
    store.mark_pending_plan(session.session_id, state_version=5)

    is_stale, expected = store.record_frame(session.session_id, "f-2", state_version=3)
    assert is_stale is True
    assert expected == 5


def test_action_result_updates_state():
    store = SessionStore(ttl_seconds=3600)
    session = store.create(
        task_intent="test",
        encoder_spec=EncoderSpec(),
        viewport=Viewport(width=800, height=600),
        client_capabilities=[],
    )
    store.record_action_result(
        session.session_id,
        ActionResultPayload(
            action_id="a-1",
            state_version=10,
            status="success",
        ),
    )
    updated = store.get(session.session_id)
    assert updated.state_version == 10
    assert updated.last_action_id == "a-1"
