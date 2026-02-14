"""Typed event models for descriptions resource socket events."""

from typing import Any

from pydantic import BaseModel


class DescriptionsGenerationStartedEvent(BaseModel):
    """Server-to-client event: descriptions_generation_started."""

    artifact_type: str
    resource_type: str = "descriptions"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class DescriptionsGenerationProgressEvent(BaseModel):
    """Server-to-client event: descriptions_generation_progress."""

    artifact_type: str
    resource_type: str = "descriptions"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class DescriptionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: descriptions_generation_complete."""

    artifact_type: str
    resource_type: str = "descriptions"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    description: str | None = None
    generated: bool | None = None


class DescriptionsGenerationErrorEvent(BaseModel):
    """Server-to-client event: descriptions_generation_error."""

    artifact_type: str
    resource_type: str = "descriptions"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
