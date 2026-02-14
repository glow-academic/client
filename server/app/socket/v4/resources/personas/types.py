"""Typed event models for personas resource socket events."""

from typing import Any

from pydantic import BaseModel


class PersonasGenerationStartedEvent(BaseModel):
    """Server-to-client event: personas_generation_started."""

    artifact_type: str
    resource_type: str = "personas"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class PersonasGenerationProgressEvent(BaseModel):
    """Server-to-client event: personas_generation_progress."""

    artifact_type: str
    resource_type: str = "personas"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class PersonasGenerationCompleteEvent(BaseModel):
    """Server-to-client event: personas_generation_complete."""

    artifact_type: str
    resource_type: str = "personas"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    persona_id: str | None = None
    name: str | None = None
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    image_model: bool | None = None
    instructions: str | None = None
    examples: list[str] | None = None
    generated: bool | None = None
    parameter_field_ids: list[str] | None = None
    parameter_ids: list[str] | None = None


class PersonasGenerationErrorEvent(BaseModel):
    """Server-to-client event: personas_generation_error."""

    artifact_type: str
    resource_type: str = "personas"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
