"""Typed event models for prompts resource socket events."""

from typing import Any

from pydantic import BaseModel


class PromptsGenerationStartedEvent(BaseModel):
    """Server-to-client event: prompts_generation_started."""

    artifact_type: str
    resource_type: str = "prompts"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class PromptsGenerationProgressEvent(BaseModel):
    """Server-to-client event: prompts_generation_progress."""

    artifact_type: str
    resource_type: str = "prompts"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class PromptsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: prompts_generation_complete."""

    artifact_type: str
    resource_type: str = "prompts"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None
    generated: bool | None = None


class PromptsGenerationErrorEvent(BaseModel):
    """Server-to-client event: prompts_generation_error."""

    artifact_type: str
    resource_type: str = "prompts"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
