"""Unified event model for scenario_time_limits resource socket events."""

from app.api.v4.resources.scenario_time_limits.types import (
    ScenarioTimeLimitsResourceData,
)


class ScenarioTimeLimitsGenerationEvent(ScenarioTimeLimitsResourceData):
    """Unified socket event for scenario_time_limits generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    resource_type: str = "scenario_time_limits"
    resource_id: str | None = None
    group_id: str | None = None
    run_id: str | None = None
    # Completion
    success: bool | None = None
    # Error
    message: str | None = None
    error_stage: str | None = None
    # Tool call tracking
    tool_call_id: str | None = None
    tool_name: str | None = None
    # Streaming
    arguments_delta: str | None = None
