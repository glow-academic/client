"""Typed event models for modalities resource socket events."""

from typing import Any

from pydantic import BaseModel


class ModalitiesGenerationStartedEvent(BaseModel):
    """Server-to-client event: modalities_generation_started."""

    artifact_type: str
    resource_type: str = "modalities"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ModalitiesGenerationProgressEvent(BaseModel):
    """Server-to-client event: modalities_generation_progress."""

    artifact_type: str
    resource_type: str = "modalities"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ModalitiesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: modalities_generation_complete."""

    artifact_type: str
    resource_type: str = "modalities"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    modality: str | None = None
    is_input: bool | None = None
    generated: bool | None = None


class ModalitiesGenerationErrorEvent(BaseModel):
    """Server-to-client event: modalities_generation_error."""

    artifact_type: str
    resource_type: str = "modalities"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
