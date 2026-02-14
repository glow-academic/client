"""Typed event models for scenario_rubrics resource socket events."""

from typing import Any

from pydantic import BaseModel


class ScenarioRubricsGenerationStartedEvent(BaseModel):
    """Server-to-client event: scenario_rubrics_generation_started."""

    artifact_type: str
    resource_type: str = "scenario_rubrics"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ScenarioRubricsGenerationProgressEvent(BaseModel):
    """Server-to-client event: scenario_rubrics_generation_progress."""

    artifact_type: str
    resource_type: str = "scenario_rubrics"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ScenarioRubricsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: scenario_rubrics_generation_complete."""

    artifact_type: str
    resource_type: str = "scenario_rubrics"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    scenario_id: str | None = None
    rubric_id: str | None = None
    generated: bool | None = None


class ScenarioRubricsGenerationErrorEvent(BaseModel):
    """Server-to-client event: scenario_rubrics_generation_error."""

    artifact_type: str
    resource_type: str = "scenario_rubrics"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
