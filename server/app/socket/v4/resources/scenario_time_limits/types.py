"""Typed event models for scenario_time_limits resource generation."""

from typing import Any

from pydantic import BaseModel


class ScenarioTimeLimitsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: scenario_time_limits_generation_complete."""

    artifact_type: str
    resource_type: str = "scenario_time_limits"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
