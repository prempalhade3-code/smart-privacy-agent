import uuid
from dataclasses import dataclass

import torch

from app.planning.representation import SpatialReasoningFeatures, extract_spatial_features
from app.schemas.messages import (
    ActionDirectivePayload,
    ActionType,
    LatentFramePayload,
)
from app.session.browser_state import BrowserSession
from app.validation.action_schema import validate_action_directive


@dataclass
class PlanningContext:
    session: BrowserSession
    frame: LatentFramePayload
    tensor: torch.Tensor
    spatial_features: SpatialReasoningFeatures


class ActionPlanningPipeline:
    def __init__(self, planner):
        self._planner = planner

    def build_context(
        self,
        session: BrowserSession,
        frame: LatentFramePayload,
        tensor: torch.Tensor,
    ) -> PlanningContext:
        grid = frame.spatial_metadata.patch_grid
        features = extract_spatial_features(
            tensor,
            grid_rows=grid.rows,
            grid_cols=grid.cols,
            sensitive_patch_indices=frame.spatial_metadata.sensitive_patch_indices,
        )
        return PlanningContext(
            session=session,
            frame=frame,
            tensor=tensor,
            spatial_features=features,
        )

    async def plan(self, context: PlanningContext) -> ActionDirectivePayload:
        raw = await self._planner.plan_action(
            task_intent=context.session.task_intent,
            spatial_features=context.spatial_features,
            state_version=context.frame.state_version,
            frame_id=context.frame.frame_id,
            last_action_id=context.frame.action_context.last_action_id,
        )
        directive = ActionDirectivePayload(
            action_id=str(uuid.uuid4()),
            action=ActionType(raw["action"]),
            target_id=raw.get("target_id"),
            coords=raw.get("coords"),
            text=raw.get("text"),
            scroll_delta=raw.get("scroll_delta"),
            state_version_required=context.frame.state_version,
            confidence=float(raw.get("confidence", 0.5)),
            reasoning_summary=raw.get("reasoning_summary", ""),
        )
        return validate_action_directive(directive)
