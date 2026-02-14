"""Typed event models for slugs resource socket events."""

from typing import Any

from pydantic import BaseModel


class SlugsGenerationStartedEvent(BaseModel):
    """Server-to-client event: slugs_generation_started."""

    artifact_type: str
    resource_type: str = "slugs"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class SlugsGenerationProgressEvent(BaseModel):
    """Server-to-client event: slugs_generation_progress."""

    artifact_type: str
    resource_type: str = "slugs"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class SlugsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: slugs_generation_complete."""

    artifact_type: str
    resource_type: str = "slugs"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    value: str | None = None
    generated: bool | None = None


class SlugsGenerationErrorEvent(BaseModel):
    """Server-to-client event: slugs_generation_error."""

    artifact_type: str
    resource_type: str = "slugs"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
