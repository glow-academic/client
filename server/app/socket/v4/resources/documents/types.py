"""Typed event models for documents resource socket events."""

from typing import Any

from pydantic import BaseModel


class DocumentsGenerationStartedEvent(BaseModel):
    """Server-to-client event: documents_generation_started."""

    artifact_type: str
    resource_type: str = "documents"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class DocumentsGenerationProgressEvent(BaseModel):
    """Server-to-client event: documents_generation_progress."""

    artifact_type: str
    resource_type: str = "documents"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class DocumentsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: documents_generation_complete."""

    artifact_type: str
    resource_type: str = "documents"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    document_id: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None
    upload_id: str | None = None
    text_id: str | None = None
    image_ids: list[str] | None = None
    template: bool | None = None
    parameter_field_ids: list[str] | None = None
    parameter_ids: list[str] | None = None


class DocumentsGenerationErrorEvent(BaseModel):
    """Server-to-client event: documents_generation_error."""

    artifact_type: str
    resource_type: str = "documents"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
