"""Typed event models for args resource socket events."""

from typing import Any

from pydantic import BaseModel


class ArgsGenerationStartedEvent(BaseModel):
    """Server-to-client event: args_generation_started."""

    artifact_type: str
    resource_type: str = "args"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ArgsGenerationProgressEvent(BaseModel):
    """Server-to-client event: args_generation_progress."""

    artifact_type: str
    resource_type: str = "args"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ArgsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: args_generation_complete."""

    artifact_type: str
    resource_type: str = "args"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    description: str | None = None
    field_type: str | None = None
    required: bool | None = None
    default_value: str | None = None
    generated: bool | None = None


class ArgsGenerationErrorEvent(BaseModel):
    """Server-to-client event: args_generation_error."""

    artifact_type: str
    resource_type: str = "args"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
