from abc import ABC, abstractmethod
from typing import Any

from app.planning.representation import SpatialReasoningFeatures


class ActionPlanner(ABC):
    @abstractmethod
    async def plan_action(
        self,
        *,
        task_intent: str,
        spatial_features: SpatialReasoningFeatures,
        state_version: int,
        frame_id: str,
        last_action_id: str | None,
    ) -> dict[str, Any]:
        """Return a dict compatible with ActionDirectivePayload fields."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Return True if the planner is reachable/ready."""
