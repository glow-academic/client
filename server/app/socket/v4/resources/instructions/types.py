"""Typed event models for instructions resource socket events."""

from typing import Any

from pydantic import BaseModel


class InstructionsGenerationStartedEvent(BaseModel):
    """Server-to-client event: instructions_generation_started."""

    artifact_type: str
    resource_type: str = "instructions"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class InstructionsGenerationProgressEvent(BaseModel):
    """Server-to-client event: instructions_generation_progress."""

    artifact_type: str
    resource_type: str = "instructions"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class InstructionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: instructions_generation_complete."""

    artifact_type: str
    resource_type: str = "instructions"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    template: str | None = None
    generated: bool | None = None


class InstructionsGenerationErrorEvent(BaseModel):
    """Server-to-client event: instructions_generation_error."""

    artifact_type: str
    resource_type: str = "instructions"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
