"""Typed event models for args_outputs resource socket events."""

from typing import Any

from pydantic import BaseModel


class ArgsOutputsGenerationStartedEvent(BaseModel):
    """Server-to-client event: args_outputs_generation_started."""

    artifact_type: str
    resource_type: str = "args_outputs"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ArgsOutputsGenerationProgressEvent(BaseModel):
    """Server-to-client event: args_outputs_generation_progress."""

    artifact_type: str
    resource_type: str = "args_outputs"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ArgsOutputsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: args_outputs_generation_complete."""

    artifact_type: str
    resource_type: str = "args_outputs"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    args_id: str | None = None
    name: str | None = None
    template: str | None = None
    generated: bool | None = None


class ArgsOutputsGenerationErrorEvent(BaseModel):
    """Server-to-client event: args_outputs_generation_error."""

    artifact_type: str
    resource_type: str = "args_outputs"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
