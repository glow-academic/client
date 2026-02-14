"""Typed event models for texts resource socket events."""

from typing import Any

from pydantic import BaseModel


class TextsGenerationStartedEvent(BaseModel):
    """Server-to-client event: texts_generation_started."""

    artifact_type: str
    resource_type: str = "texts"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class TextsGenerationProgressEvent(BaseModel):
    """Server-to-client event: texts_generation_progress."""

    artifact_type: str
    resource_type: str = "texts"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class TextsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: texts_generation_complete."""

    artifact_type: str
    resource_type: str = "texts"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    texts_id: str | None = None
    text_id: str | None = None
    generated: bool | None = None


class TextsGenerationErrorEvent(BaseModel):
    """Server-to-client event: texts_generation_error."""

    artifact_type: str
    resource_type: str = "texts"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
