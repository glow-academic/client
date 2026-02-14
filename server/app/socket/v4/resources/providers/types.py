"""Typed event models for providers resource socket events."""

from typing import Any

from pydantic import BaseModel


class ProvidersGenerationStartedEvent(BaseModel):
    """Server-to-client event: providers_generation_started."""

    artifact_type: str
    resource_type: str = "providers"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ProvidersGenerationProgressEvent(BaseModel):
    """Server-to-client event: providers_generation_progress."""

    artifact_type: str
    resource_type: str = "providers"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ProvidersGenerationCompleteEvent(BaseModel):
    """Server-to-client event: providers_generation_complete."""

    artifact_type: str
    resource_type: str = "providers"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    value: str | None = None
    name: str | None = None
    description: str | None = None
    endpoint: str | None = None
    key: str | None = None
    active: bool | None = None
    generated: bool | None = None


class ProvidersGenerationErrorEvent(BaseModel):
    """Server-to-client event: providers_generation_error."""

    artifact_type: str
    resource_type: str = "providers"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
