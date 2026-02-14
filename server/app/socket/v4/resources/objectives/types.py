"""Typed event models for objectives resource socket events."""

from typing import Any

from pydantic import BaseModel


class ObjectivesGenerationStartedEvent(BaseModel):
    """Server-to-client event: objectives_generation_started."""

    artifact_type: str
    resource_type: str = "objectives"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ObjectivesGenerationProgressEvent(BaseModel):
    """Server-to-client event: objectives_generation_progress."""

    artifact_type: str
    resource_type: str = "objectives"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ObjectivesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: objectives_generation_complete."""

    artifact_type: str
    resource_type: str = "objectives"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    objective_id: str | None = None
    objective: str | None = None
    generated: bool | None = None


class ObjectivesGenerationErrorEvent(BaseModel):
    """Server-to-client event: objectives_generation_error."""

    artifact_type: str
    resource_type: str = "objectives"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
