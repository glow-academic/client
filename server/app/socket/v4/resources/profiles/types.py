"""Typed event models for profiles resource socket events."""

from typing import Any

from pydantic import BaseModel


class ProfilesGenerationStartedEvent(BaseModel):
    """Server-to-client event: profiles_generation_started."""

    artifact_type: str
    resource_type: str = "profiles"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ProfilesGenerationProgressEvent(BaseModel):
    """Server-to-client event: profiles_generation_progress."""

    artifact_type: str
    resource_type: str = "profiles"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ProfilesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: profiles_generation_complete."""

    artifact_type: str
    resource_type: str = "profiles"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    profile_id: str | None = None
    name: str | None = None
    description: str | None = None
    emails: list[str] | None = None
    primary_email: str | None = None


class ProfilesGenerationErrorEvent(BaseModel):
    """Server-to-client event: profiles_generation_error."""

    artifact_type: str
    resource_type: str = "profiles"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
