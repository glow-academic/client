"""Typed event models for standards resource socket events."""

from typing import Any

from pydantic import BaseModel


class StandardsGenerationStartedEvent(BaseModel):
    """Server-to-client event: standards_generation_started."""

    artifact_type: str
    resource_type: str = "standards"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class StandardsGenerationProgressEvent(BaseModel):
    """Server-to-client event: standards_generation_progress."""

    artifact_type: str
    resource_type: str = "standards"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class StandardsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: standards_generation_complete."""

    artifact_type: str
    resource_type: str = "standards"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    standard_id: str | None = None
    standard_group_id: str | None = None
    name: str | None = None
    description: str | None = None
    points: float | None = None


class StandardsGenerationErrorEvent(BaseModel):
    """Server-to-client event: standards_generation_error."""

    artifact_type: str
    resource_type: str = "standards"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
