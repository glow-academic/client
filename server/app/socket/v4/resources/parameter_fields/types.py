"""Typed event models for parameter_fields resource socket events."""

from typing import Any

from pydantic import BaseModel


class ParameterFieldsGenerationStartedEvent(BaseModel):
    """Server-to-client event: parameter_fields_generation_started."""

    artifact_type: str
    resource_type: str = "parameter_fields"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ParameterFieldsGenerationProgressEvent(BaseModel):
    """Server-to-client event: parameter_fields_generation_progress."""

    artifact_type: str
    resource_type: str = "parameter_fields"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ParameterFieldsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: parameter_fields_generation_complete."""

    artifact_type: str
    resource_type: str = "parameter_fields"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    field_id: str | None = None
    parameter_id: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None
    conditional_parameter_id: str | None = None


class ParameterFieldsGenerationErrorEvent(BaseModel):
    """Server-to-client event: parameter_fields_generation_error."""

    artifact_type: str
    resource_type: str = "parameter_fields"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
