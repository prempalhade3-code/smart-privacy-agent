import pytest
import torch

from app.config.settings import Settings
from app.planning.pipeline import ActionPlanningPipeline
from app.planning.representation import extract_spatial_features
from app.models.mock_planner import MockActionPlanner
from app.session.browser_state import BrowserSession, SessionStore
from app.schemas.messages import EncoderSpec, Viewport
from tests.conftest import make_latent_frame_payload, make_sanitized_tensor, make_test_settings


def test_extract_spatial_features_dominant_patch():
    tensor = make_sanitized_tensor()
    features = extract_spatial_features(tensor, 24, 24, [100])
    assert features.dominant_patch_index == 100
    x, y = features.dominant_patch_coords
    assert 0.0 <= x <= 1.0
    assert 0.0 <= y <= 1.0
    assert features.sensitive_patch_count == 1


@pytest.mark.asyncio
async def test_mock_planner_click():
    tensor = make_sanitized_tensor()
    features = extract_spatial_features(tensor, 24, 24, [])
    planner = MockActionPlanner()
    result = await planner.plan_action(
        task_intent="Click the login button",
        spatial_features=features,
        state_version=1,
        frame_id="f-1",
        last_action_id=None,
    )
    assert result["action"] == "CLICK"
    assert result["coords"] is not None


@pytest.mark.asyncio
async def test_planning_pipeline_end_to_end():
    settings = make_test_settings()
    store = SessionStore(ttl_seconds=3600)
    session = store.create(
        task_intent="Click submit",
        encoder_spec=EncoderSpec(),
        viewport=Viewport(width=1920, height=1080),
        client_capabilities=[],
    )
    frame_dict = make_latent_frame_payload()
    from app.validation.latent_payload import validate_latent_frame
    from app.schemas.messages import LatentFramePayload

    frame = validate_latent_frame(frame_dict, settings)
    tensor = make_sanitized_tensor()
    pipeline = ActionPlanningPipeline(MockActionPlanner())
    context = pipeline.build_context(session, frame, tensor)
    directive = await pipeline.plan(context)
    assert directive.action.value == "CLICK"
    assert directive.coords is not None
    assert directive.state_version_required == 1
