"""Typed event models for standard_groups resource socket events."""

from typing import Any

from pydantic import BaseModel


class StandardGroupsGenerationStartedEvent(BaseModel):
    """Server-to-client event: standard_groups_generation_started."""

    artifact_type: str
    resource_type: str = "standard_groups"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class StandardGroupsGenerationProgressEvent(BaseModel):
    """Server-to-client event: standard_groups_generation_progress."""

    artifact_type: str
    resource_type: str = "standard_groups"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class StandardGroupsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: standard_groups_generation_complete."""

    artifact_type: str
    resource_type: str = "standard_groups"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    standard_group_id: str | None = None
    name: str | None = None
    description: str | None = None
    points: float | None = None
    pass_points: float | None = None


class StandardGroupsGenerationErrorEvent(BaseModel):
    """Server-to-client event: standard_groups_generation_error."""

    artifact_type: str
    resource_type: str = "standard_groups"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
