"""Typed event models for videos resource socket events."""

from typing import Any

from pydantic import BaseModel


class VideosGenerationStartedEvent(BaseModel):
    """Server-to-client event: videos_generation_started."""

    artifact_type: str
    resource_type: str = "videos"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class VideosGenerationProgressEvent(BaseModel):
    """Server-to-client event: videos_generation_progress."""

    artifact_type: str
    resource_type: str = "videos"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class VideosGenerationCompleteEvent(BaseModel):
    """Server-to-client event: videos_generation_complete."""

    artifact_type: str
    resource_type: str = "videos"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    video_id: str | None = None
    name: str | None = None
    description: str | None = None
    upload_id: str | None = None
    generated: bool | None = None


class VideosGenerationErrorEvent(BaseModel):
    """Server-to-client event: videos_generation_error."""

    artifact_type: str
    resource_type: str = "videos"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
