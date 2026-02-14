"""Typed event models for parameters resource socket events."""

from typing import Any

from pydantic import BaseModel


class ParametersGenerationStartedEvent(BaseModel):
    """Server-to-client event: parameters_generation_started."""

    artifact_type: str
    resource_type: str = "parameters"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ParametersGenerationProgressEvent(BaseModel):
    """Server-to-client event: parameters_generation_progress."""

    artifact_type: str
    resource_type: str = "parameters"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ParametersGenerationCompleteEvent(BaseModel):
    """Server-to-client event: parameters_generation_complete."""

    artifact_type: str
    resource_type: str = "parameters"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    parameter_id: str | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    generated: bool | None = None
    persona_parameter: bool | None = None
    document_parameter: bool | None = None
    scenario_parameter: bool | None = None
    video_parameter: bool | None = None
    conditional: bool | None = None
    field_ids: list[str] | None = None


class ParametersGenerationErrorEvent(BaseModel):
    """Server-to-client event: parameters_generation_error."""

    artifact_type: str
    resource_type: str = "parameters"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
