"""Typed event models for emails resource socket events."""

from typing import Any

from pydantic import BaseModel


class EmailsGenerationStartedEvent(BaseModel):
    """Server-to-client event: emails_generation_started."""

    artifact_type: str
    resource_type: str = "emails"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class EmailsGenerationProgressEvent(BaseModel):
    """Server-to-client event: emails_generation_progress."""

    artifact_type: str
    resource_type: str = "emails"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class EmailsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: emails_generation_complete."""

    artifact_type: str
    resource_type: str = "emails"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    email: str | None = None
    generated: bool | None = None


class EmailsGenerationErrorEvent(BaseModel):
    """Server-to-client event: emails_generation_error."""

    artifact_type: str
    resource_type: str = "emails"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
