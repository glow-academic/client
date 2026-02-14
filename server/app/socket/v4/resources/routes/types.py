"""Typed event models for routes resource socket events."""

from typing import Any

from pydantic import BaseModel


class RoutesGenerationStartedEvent(BaseModel):
    """Server-to-client event: routes_generation_started."""

    artifact_type: str
    resource_type: str = "routes"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class RoutesGenerationProgressEvent(BaseModel):
    """Server-to-client event: routes_generation_progress."""

    artifact_type: str
    resource_type: str = "routes"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class RoutesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: routes_generation_complete."""

    artifact_type: str
    resource_type: str = "routes"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    route: str | None = None
    generated: bool | None = None


class RoutesGenerationErrorEvent(BaseModel):
    """Server-to-client event: routes_generation_error."""

    artifact_type: str
    resource_type: str = "routes"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
