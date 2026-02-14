"""Typed event models for bindings resource socket events."""

from typing import Any

from pydantic import BaseModel


class BindingsGenerationStartedEvent(BaseModel):
    """Server-to-client event: bindings_generation_started."""

    artifact_type: str
    resource_type: str = "bindings"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class BindingsGenerationProgressEvent(BaseModel):
    """Server-to-client event: bindings_generation_progress."""

    artifact_type: str
    resource_type: str = "bindings"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class BindingsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: bindings_generation_complete."""

    artifact_type: str
    resource_type: str = "bindings"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    entry: str | None = None
    generated: bool | None = None


class BindingsGenerationErrorEvent(BaseModel):
    """Server-to-client event: bindings_generation_error."""

    artifact_type: str
    resource_type: str = "bindings"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
