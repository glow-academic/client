"""Typed event models for conditional_parameters resource socket events."""

from typing import Any

from pydantic import BaseModel


class ConditionalParametersGenerationStartedEvent(BaseModel):
    """Server-to-client event: conditional_parameters_generation_started."""

    artifact_type: str
    resource_type: str = "conditional_parameters"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ConditionalParametersGenerationProgressEvent(BaseModel):
    """Server-to-client event: conditional_parameters_generation_progress."""

    artifact_type: str
    resource_type: str = "conditional_parameters"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ConditionalParametersGenerationCompleteEvent(BaseModel):
    """Server-to-client event: conditional_parameters_generation_complete."""

    artifact_type: str
    resource_type: str = "conditional_parameters"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    parameter_id: str | None = None
    generated: bool | None = None


class ConditionalParametersGenerationErrorEvent(BaseModel):
    """Server-to-client event: conditional_parameters_generation_error."""

    artifact_type: str
    resource_type: str = "conditional_parameters"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
