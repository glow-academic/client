"""Typed event models for group_positions resource socket events."""

from typing import Any

from pydantic import BaseModel


class GroupPositionsGenerationStartedEvent(BaseModel):
    """Server-to-client event: group_positions_generation_started."""

    artifact_type: str
    resource_type: str = "group_positions"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class GroupPositionsGenerationProgressEvent(BaseModel):
    """Server-to-client event: group_positions_generation_progress."""

    artifact_type: str
    resource_type: str = "group_positions"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class GroupPositionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: group_positions_generation_complete."""

    artifact_type: str
    resource_type: str = "group_positions"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    groups_id: str | None = None
    eval_id: str | None = None
    value: int | None = None
    generated: bool | None = None


class GroupPositionsGenerationErrorEvent(BaseModel):
    """Server-to-client event: group_positions_generation_error."""

    artifact_type: str
    resource_type: str = "group_positions"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
