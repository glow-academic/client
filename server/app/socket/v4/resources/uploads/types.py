"""Typed event models for uploads resource socket events."""

from typing import Any

from pydantic import BaseModel


class UploadsGenerationStartedEvent(BaseModel):
    """Server-to-client event: uploads_generation_started."""

    artifact_type: str
    resource_type: str = "uploads"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class UploadsGenerationProgressEvent(BaseModel):
    """Server-to-client event: uploads_generation_progress."""

    artifact_type: str
    resource_type: str = "uploads"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class UploadsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: uploads_generation_complete."""

    artifact_type: str
    resource_type: str = "uploads"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    uploads_id: str | None = None
    upload_id: str | None = None
    generated: bool | None = None


class UploadsGenerationErrorEvent(BaseModel):
    """Server-to-client event: uploads_generation_error."""

    artifact_type: str
    resource_type: str = "uploads"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
