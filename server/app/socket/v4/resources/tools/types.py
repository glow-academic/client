"""Typed event models for tools resource socket events."""

from typing import Any

from pydantic import BaseModel


class ToolsGenerationStartedEvent(BaseModel):
    """Server-to-client event: tools_generation_started."""

    artifact_type: str
    resource_type: str = "tools"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ToolsGenerationProgressEvent(BaseModel):
    """Server-to-client event: tools_generation_progress."""

    artifact_type: str
    resource_type: str = "tools"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ToolsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: tools_generation_complete."""

    artifact_type: str
    resource_type: str = "tools"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class ToolsGenerationErrorEvent(BaseModel):
    """Server-to-client event: tools_generation_error."""

    artifact_type: str
    resource_type: str = "tools"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
