"""Typed event models for scenario_flags resource socket events."""

from typing import Any

from pydantic import BaseModel


class ScenarioFlagsGenerationStartedEvent(BaseModel):
    """Server-to-client event: scenario_flags_generation_started."""

    artifact_type: str
    resource_type: str = "scenario_flags"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ScenarioFlagsGenerationProgressEvent(BaseModel):
    """Server-to-client event: scenario_flags_generation_progress."""

    artifact_type: str
    resource_type: str = "scenario_flags"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ScenarioFlagsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: scenario_flags_generation_complete."""

    artifact_type: str
    resource_type: str = "scenario_flags"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    scenario_id: str | None = None
    flag_id: str | None = None
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    generated: bool | None = None


class ScenarioFlagsGenerationErrorEvent(BaseModel):
    """Server-to-client event: scenario_flags_generation_error."""

    artifact_type: str
    resource_type: str = "scenario_flags"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
