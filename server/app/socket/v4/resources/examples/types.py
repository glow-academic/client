"""Typed event models for examples resource socket events."""

from typing import Any

from pydantic import BaseModel


class ExamplesGenerationStartedEvent(BaseModel):
    """Server-to-client event: examples_generation_started."""

    artifact_type: str
    resource_type: str = "examples"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ExamplesGenerationProgressEvent(BaseModel):
    """Server-to-client event: examples_generation_progress."""

    artifact_type: str
    resource_type: str = "examples"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ExamplesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: examples_generation_complete."""

    artifact_type: str
    resource_type: str = "examples"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    example: str | None = None
    idx: int | None = None
    generated: bool | None = None


class ExamplesGenerationErrorEvent(BaseModel):
    """Server-to-client event: examples_generation_error."""

    artifact_type: str
    resource_type: str = "examples"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
