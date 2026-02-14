"""Typed event models for scenario_time_limits resource socket events."""

from typing import Any

from pydantic import BaseModel


class ScenarioTimeLimitsGenerationStartedEvent(BaseModel):
    """Server-to-client event: scenario_time_limits_generation_started."""

    artifact_type: str
    resource_type: str = "scenario_time_limits"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ScenarioTimeLimitsGenerationProgressEvent(BaseModel):
    """Server-to-client event: scenario_time_limits_generation_progress."""

    artifact_type: str
    resource_type: str = "scenario_time_limits"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ScenarioTimeLimitsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: scenario_time_limits_generation_complete."""

    artifact_type: str
    resource_type: str = "scenario_time_limits"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    scenario_id: str | None = None
    time_limit_seconds: int | None = None
    generated: bool | None = None


class ScenarioTimeLimitsGenerationErrorEvent(BaseModel):
    """Server-to-client event: scenario_time_limits_generation_error."""

    artifact_type: str
    resource_type: str = "scenario_time_limits"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
