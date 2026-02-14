"""Typed event models for thresholds resource socket events."""

from typing import Any

from pydantic import BaseModel


class ThresholdsGenerationStartedEvent(BaseModel):
    """Server-to-client event: thresholds_generation_started."""

    artifact_type: str
    resource_type: str = "thresholds"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ThresholdsGenerationProgressEvent(BaseModel):
    """Server-to-client event: thresholds_generation_progress."""

    artifact_type: str
    resource_type: str = "thresholds"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ThresholdsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: thresholds_generation_complete."""

    artifact_type: str
    resource_type: str = "thresholds"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    value: int | None = None
    generated: bool | None = None


class ThresholdsGenerationErrorEvent(BaseModel):
    """Server-to-client event: thresholds_generation_error."""

    artifact_type: str
    resource_type: str = "thresholds"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
