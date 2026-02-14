"""Typed event models for options resource socket events."""

from typing import Any

from pydantic import BaseModel


class OptionsGenerationStartedEvent(BaseModel):
    """Server-to-client event: options_generation_started."""

    artifact_type: str
    resource_type: str = "options"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class OptionsGenerationProgressEvent(BaseModel):
    """Server-to-client event: options_generation_progress."""

    artifact_type: str
    resource_type: str = "options"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class OptionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: options_generation_complete."""

    artifact_type: str
    resource_type: str = "options"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    option_id: str | None = None
    option_text: str | None = None
    is_correct: bool | None = None
    generated: bool | None = None
    question_id: str | None = None


class OptionsGenerationErrorEvent(BaseModel):
    """Server-to-client event: options_generation_error."""

    artifact_type: str
    resource_type: str = "options"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
