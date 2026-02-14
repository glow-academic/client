"""Typed event models for roles resource socket events."""

from typing import Any

from pydantic import BaseModel


class RolesGenerationStartedEvent(BaseModel):
    """Server-to-client event: roles_generation_started."""

    artifact_type: str
    resource_type: str = "roles"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class RolesGenerationProgressEvent(BaseModel):
    """Server-to-client event: roles_generation_progress."""

    artifact_type: str
    resource_type: str = "roles"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class RolesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: roles_generation_complete."""

    artifact_type: str
    resource_type: str = "roles"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    role: str | None = None
    name: str | None = None
    description: str | None = None
    icon_value: str | None = None
    color_hex: str | None = None


class RolesGenerationErrorEvent(BaseModel):
    """Server-to-client event: roles_generation_error."""

    artifact_type: str
    resource_type: str = "roles"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
