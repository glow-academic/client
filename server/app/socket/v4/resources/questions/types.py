"""Typed event models for questions resource socket events."""

from typing import Any

from pydantic import BaseModel


class QuestionsGenerationStartedEvent(BaseModel):
    """Server-to-client event: questions_generation_started."""

    artifact_type: str
    resource_type: str = "questions"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class QuestionsGenerationProgressEvent(BaseModel):
    """Server-to-client event: questions_generation_progress."""

    artifact_type: str
    resource_type: str = "questions"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class QuestionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: questions_generation_complete."""

    artifact_type: str
    resource_type: str = "questions"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    question_id: str | None = None
    question_text: str | None = None
    allow_multiple: bool | None = None
    generated: bool | None = None
    time: int | None = None


class QuestionsGenerationErrorEvent(BaseModel):
    """Server-to-client event: questions_generation_error."""

    artifact_type: str
    resource_type: str = "questions"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
