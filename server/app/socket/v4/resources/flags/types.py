"""Typed event models for flags resource socket events."""

from typing import Any

from pydantic import BaseModel


class FlagsGenerationStartedEvent(BaseModel):
    """Server-to-client event: flags_generation_started."""

    artifact_type: str
    resource_type: str = "flags"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class FlagsGenerationProgressEvent(BaseModel):
    """Server-to-client event: flags_generation_progress."""

    artifact_type: str
    resource_type: str = "flags"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class FlagsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: flags_generation_complete."""

    artifact_type: str
    resource_type: str = "flags"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    generated: bool | None = None


class FlagsGenerationErrorEvent(BaseModel):
    """Server-to-client event: flags_generation_error."""

    artifact_type: str
    resource_type: str = "flags"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
