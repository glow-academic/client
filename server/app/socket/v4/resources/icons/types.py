"""Typed event models for icons resource socket events."""

from typing import Any

from pydantic import BaseModel


class IconsGenerationStartedEvent(BaseModel):
    """Server-to-client event: icons_generation_started."""

    artifact_type: str
    resource_type: str = "icons"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class IconsGenerationProgressEvent(BaseModel):
    """Server-to-client event: icons_generation_progress."""

    artifact_type: str
    resource_type: str = "icons"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class IconsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: icons_generation_complete."""

    artifact_type: str
    resource_type: str = "icons"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    generated: bool | None = None


class IconsGenerationErrorEvent(BaseModel):
    """Server-to-client event: icons_generation_error."""

    artifact_type: str
    resource_type: str = "icons"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
