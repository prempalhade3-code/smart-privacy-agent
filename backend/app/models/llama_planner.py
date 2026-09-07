"""LLaMA-3-70B planner via OpenAI-compatible HTTP API."""

import json
import re
from typing import Any

import httpx

from app.config.settings import Settings
from app.models.base import ActionPlanner
from app.planning.representation import SpatialReasoningFeatures


class LlamaActionPlanner(ActionPlanner):
    def __init__(self, settings: Settings):
        self._settings = settings
        self._client = httpx.AsyncClient(
            base_url=settings.vdlm_llama_base_url,
            timeout=settings.vdlm_llama_timeout_seconds,
            headers={"Authorization": f"Bearer {settings.vdlm_llama_api_key}"}
            if settings.vdlm_llama_api_key
            else {},
        )

    async def plan_action(
        self,
        *,
        task_intent: str,
        spatial_features: SpatialReasoningFeatures,
        state_version: int,
        frame_id: str,
        last_action_id: str | None,
    ) -> dict[str, Any]:
        system_prompt = (
            "You are a browser agent macro-action planner. You receive a spatial summary "
            "derived from SANITIZED vision latents (no raw pixels). Respond with ONLY valid JSON:\n"
            '{"action":"CLICK|SCROLL|TYPE|WAIT|NAVIGATE|DONE","target_id":int|null,'
            '"coords":[x,y]|null,"text":str|null,"scroll_delta":[dx,dy]|null,'
            '"confidence":0-1,"reasoning_summary":"..."}\n'
            "Coords must be normalized [0,1]. Never request screenshots or DOM HTML."
        )
        user_prompt = (
            f"Task: {task_intent}\n"
            f"Frame: {frame_id}, state_version: {state_version}\n"
            f"Last action: {last_action_id}\n\n"
            f"{spatial_features.to_prompt_context()}"
        )

        response = await self._client.post(
            "/chat/completions",
            json={
                "model": self._settings.vdlm_llama_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.1,
                "max_tokens": 512,
            },
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        return self._parse_json_response(content)

    async def health_check(self) -> bool:
        try:
            response = await self._client.get("/models")
            return response.status_code < 500
        except httpx.HTTPError:
            return False

    @staticmethod
    def _parse_json_response(content: str) -> dict[str, Any]:
        content = content.strip()
        fence = re.search(r"```(?:json)?\s*(.*?)\s*```", content, re.DOTALL)
        if fence:
            content = fence.group(1)
        return json.loads(content)
