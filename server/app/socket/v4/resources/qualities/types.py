"""Typed event models for qualities resource socket events."""

from typing import Any

from pydantic import BaseModel


class QualitiesGenerationStartedEvent(BaseModel):
    """Server-to-client event: qualities_generation_started."""

    artifact_type: str
    resource_type: str = "qualities"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class QualitiesGenerationProgressEvent(BaseModel):
    """Server-to-client event: qualities_generation_progress."""

    artifact_type: str
    resource_type: str = "qualities"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class QualitiesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: qualities_generation_complete."""

    artifact_type: str
    resource_type: str = "qualities"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    quality: str | None = None
    generated: bool | None = None


class QualitiesGenerationErrorEvent(BaseModel):
    """Server-to-client event: qualities_generation_error."""

    artifact_type: str
    resource_type: str = "qualities"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
