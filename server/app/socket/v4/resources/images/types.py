"""Typed event models for images resource socket events."""

from typing import Any

from pydantic import BaseModel


class ImagesGenerationStartedEvent(BaseModel):
    """Server-to-client event: images_generation_started."""

    artifact_type: str
    resource_type: str = "images"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ImagesGenerationProgressEvent(BaseModel):
    """Server-to-client event: images_generation_progress."""

    artifact_type: str
    resource_type: str = "images"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ImagesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: images_generation_complete."""

    artifact_type: str
    resource_type: str = "images"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    image_id: str | None = None
    name: str | None = None
    description: str | None = None
    upload_id: str | None = None
    generated: bool | None = None


class ImagesGenerationErrorEvent(BaseModel):
    """Server-to-client event: images_generation_error."""

    artifact_type: str
    resource_type: str = "images"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
