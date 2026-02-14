"""Typed event models for agents resource socket events."""

from typing import Any

from pydantic import BaseModel


class AgentsGenerationStartedEvent(BaseModel):
    """Server-to-client event: agents_generation_started."""

    artifact_type: str
    resource_type: str = "agents"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class AgentsGenerationProgressEvent(BaseModel):
    """Server-to-client event: agents_generation_progress."""

    artifact_type: str
    resource_type: str = "agents"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class AgentsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: agents_generation_complete."""

    artifact_type: str
    resource_type: str = "agents"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    description: str | None = None
    model_id: str | None = None
    temperature: float | None = None
    reasoning: str | None = None
    tool_ids: list[str] | None = None
    quality: str | None = None
    voice: str | None = None
    prompt_id: str | None = None
    instruction_ids: list[str] | None = None
    active: bool | None = None
    generated: bool | None = None


class AgentsGenerationErrorEvent(BaseModel):
    """Server-to-client event: agents_generation_error."""

    artifact_type: str
    resource_type: str = "agents"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
