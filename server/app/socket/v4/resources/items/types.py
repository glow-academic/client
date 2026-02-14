"""Typed event models for items resource socket events."""

from typing import Any

from pydantic import BaseModel


class ItemsGenerationStartedEvent(BaseModel):
    """Server-to-client event: items_generation_started."""

    artifact_type: str
    resource_type: str = "items"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ItemsGenerationProgressEvent(BaseModel):
    """Server-to-client event: items_generation_progress."""

    artifact_type: str
    resource_type: str = "items"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ItemsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: items_generation_complete."""

    artifact_type: str
    resource_type: str = "items"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    description: str | None = None
    encrypted: bool | None = None
    position: int | None = None
    generated: bool | None = None


class ItemsGenerationErrorEvent(BaseModel):
    """Server-to-client event: items_generation_error."""

    artifact_type: str
    resource_type: str = "items"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
