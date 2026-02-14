"""Typed event models for scenario_positions resource socket events."""

from typing import Any

from pydantic import BaseModel


class ScenarioPositionsGenerationStartedEvent(BaseModel):
    """Server-to-client event: scenario_positions_generation_started."""

    artifact_type: str
    resource_type: str = "scenario_positions"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ScenarioPositionsGenerationProgressEvent(BaseModel):
    """Server-to-client event: scenario_positions_generation_progress."""

    artifact_type: str
    resource_type: str = "scenario_positions"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ScenarioPositionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: scenario_positions_generation_complete."""

    artifact_type: str
    resource_type: str = "scenario_positions"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    scenario_id: str | None = None
    value: int | None = None
    generated: bool | None = None


class ScenarioPositionsGenerationErrorEvent(BaseModel):
    """Server-to-client event: scenario_positions_generation_error."""

    artifact_type: str
    resource_type: str = "scenario_positions"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
