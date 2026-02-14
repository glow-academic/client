"""Typed event models for domains resource socket events."""

from typing import Any

from pydantic import BaseModel


class DomainsGenerationStartedEvent(BaseModel):
    """Server-to-client event: domains_generation_started."""

    artifact_type: str
    resource_type: str = "domains"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class DomainsGenerationProgressEvent(BaseModel):
    """Server-to-client event: domains_generation_progress."""

    artifact_type: str
    resource_type: str = "domains"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class DomainsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: domains_generation_complete."""

    artifact_type: str
    resource_type: str = "domains"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    resource: str | None = None
    creatable: bool | None = None
    generated: bool | None = None


class DomainsGenerationErrorEvent(BaseModel):
    """Server-to-client event: domains_generation_error."""

    artifact_type: str
    resource_type: str = "domains"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
