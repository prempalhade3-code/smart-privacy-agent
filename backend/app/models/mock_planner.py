"""Deterministic mock planner for local development and testing."""

from typing import Any

from app.models.base import ActionPlanner
from app.planning.representation import SpatialReasoningFeatures


class MockActionPlanner(ActionPlanner):
    async def plan_action(
        self,
        *,
        task_intent: str,
        spatial_features: SpatialReasoningFeatures,
        state_version: int,
        frame_id: str,
        last_action_id: str | None,
    ) -> dict[str, Any]:
        intent_lower = task_intent.lower()
        x, y = spatial_features.dominant_patch_coords

        if "scroll" in intent_lower:
            return {
                "action": "SCROLL",
                "scroll_delta": [0.0, 300.0],
                "confidence": 0.75,
                "reasoning_summary": "Task intent mentions scrolling; issuing downward scroll.",
            }

        if "type" in intent_lower or "enter" in intent_lower or "input" in intent_lower:
            return {
                "action": "TYPE",
                "coords": [x, y],
                "text": "example_input",
                "target_id": spatial_features.dominant_patch_index,
                "confidence": 0.8,
                "reasoning_summary": (
                    f"Typing at dominant patch {spatial_features.dominant_patch_index} "
                    f"({x:.2f}, {y:.2f}) based on sanitized spatial features."
                ),
            }

        if "navigate" in intent_lower or "http" in intent_lower or "url" in intent_lower:
            return {
                "action": "NAVIGATE",
                "text": "https://example.com",
                "confidence": 0.7,
                "reasoning_summary": "Navigation intent detected.",
            }

        if last_action_id and state_version > 2:
            return {
                "action": "DONE",
                "confidence": 0.9,
                "reasoning_summary": "Follow-up frame after prior action; marking task complete.",
            }

        return {
            "action": "CLICK",
            "coords": [x, y],
            "target_id": spatial_features.dominant_patch_index,
            "confidence": 0.85,
            "reasoning_summary": (
                f"Click at dominant spatial activation ({x:.2f}, {y:.2f}), "
                f"patch index {spatial_features.dominant_patch_index}."
            ),
        }

    async def health_check(self) -> bool:
        return True
