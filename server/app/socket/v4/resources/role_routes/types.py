"""Typed event models for role_routes resource socket events."""

from typing import Any

from pydantic import BaseModel


class RoleRoutesGenerationStartedEvent(BaseModel):
    """Server-to-client event: role_routes_generation_started."""

    artifact_type: str
    resource_type: str = "role_routes"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class RoleRoutesGenerationProgressEvent(BaseModel):
    """Server-to-client event: role_routes_generation_progress."""

    artifact_type: str
    resource_type: str = "role_routes"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class RoleRoutesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: role_routes_generation_complete."""

    artifact_type: str
    resource_type: str = "role_routes"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    role_id: str | None = None
    route_id: str | None = None
    generated: bool | None = None


class RoleRoutesGenerationErrorEvent(BaseModel):
    """Server-to-client event: role_routes_generation_error."""

    artifact_type: str
    resource_type: str = "role_routes"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
