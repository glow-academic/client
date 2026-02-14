"""Typed event models for names resource socket events."""

from typing import Any

from pydantic import BaseModel


class NamesGenerationStartedEvent(BaseModel):
    """Server-to-client event: names_generation_started."""

    artifact_type: str
    resource_type: str = "names"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class NamesGenerationProgressEvent(BaseModel):
    """Server-to-client event: names_generation_progress."""

    artifact_type: str
    resource_type: str = "names"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class NamesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: names_generation_complete."""

    artifact_type: str
    resource_type: str = "names"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    generated: bool | None = None


class NamesGenerationErrorEvent(BaseModel):
    """Server-to-client event: names_generation_error."""

    artifact_type: str
    resource_type: str = "names"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
