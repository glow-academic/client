"""Typed event models for reasoning_levels resource socket events."""

from typing import Any

from pydantic import BaseModel


class ReasoningLevelsGenerationStartedEvent(BaseModel):
    """Server-to-client event: reasoning_levels_generation_started."""

    artifact_type: str
    resource_type: str = "reasoning_levels"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ReasoningLevelsGenerationProgressEvent(BaseModel):
    """Server-to-client event: reasoning_levels_generation_progress."""

    artifact_type: str
    resource_type: str = "reasoning_levels"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ReasoningLevelsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: reasoning_levels_generation_complete."""

    artifact_type: str
    resource_type: str = "reasoning_levels"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    reasoning_level: str | None = None
    generated: bool | None = None


class ReasoningLevelsGenerationErrorEvent(BaseModel):
    """Server-to-client event: reasoning_levels_generation_error."""

    artifact_type: str
    resource_type: str = "reasoning_levels"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
