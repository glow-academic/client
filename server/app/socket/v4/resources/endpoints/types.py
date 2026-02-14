"""Typed event models for endpoints resource socket events."""

from typing import Any

from pydantic import BaseModel


class EndpointsGenerationStartedEvent(BaseModel):
    """Server-to-client event: endpoints_generation_started."""

    artifact_type: str
    resource_type: str = "endpoints"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class EndpointsGenerationProgressEvent(BaseModel):
    """Server-to-client event: endpoints_generation_progress."""

    artifact_type: str
    resource_type: str = "endpoints"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class EndpointsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: endpoints_generation_complete."""

    artifact_type: str
    resource_type: str = "endpoints"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    base_url: str | None = None
    generated: bool | None = None


class EndpointsGenerationErrorEvent(BaseModel):
    """Server-to-client event: endpoints_generation_error."""

    artifact_type: str
    resource_type: str = "endpoints"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
