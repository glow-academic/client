"""Typed event models for scenario_personas resource socket events."""

from typing import Any

from pydantic import BaseModel


class ScenarioPersonasGenerationStartedEvent(BaseModel):
    """Server-to-client event: scenario_personas_generation_started."""

    artifact_type: str
    resource_type: str = "scenario_personas"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ScenarioPersonasGenerationProgressEvent(BaseModel):
    """Server-to-client event: scenario_personas_generation_progress."""

    artifact_type: str
    resource_type: str = "scenario_personas"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ScenarioPersonasGenerationCompleteEvent(BaseModel):
    """Server-to-client event: scenario_personas_generation_complete."""

    artifact_type: str
    resource_type: str = "scenario_personas"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    scenario_id: str | None = None
    persona_id: str | None = None
    generated: bool | None = None


class ScenarioPersonasGenerationErrorEvent(BaseModel):
    """Server-to-client event: scenario_personas_generation_error."""

    artifact_type: str
    resource_type: str = "scenario_personas"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
