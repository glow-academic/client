"""Typed event models for points resource socket events."""

from typing import Any

from pydantic import BaseModel


class PointsGenerationStartedEvent(BaseModel):
    """Server-to-client event: points_generation_started."""

    artifact_type: str
    resource_type: str = "points"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class PointsGenerationProgressEvent(BaseModel):
    """Server-to-client event: points_generation_progress."""

    artifact_type: str
    resource_type: str = "points"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class PointsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: points_generation_complete."""

    artifact_type: str
    resource_type: str = "points"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    value: int | None = None
    generated: bool | None = None


class PointsGenerationErrorEvent(BaseModel):
    """Server-to-client event: points_generation_error."""

    artifact_type: str
    resource_type: str = "points"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
