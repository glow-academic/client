"""Base event types for per-resource socket events.

Shared across all resource types. Per-resource complete event types
are defined in each resource's types.py module.
"""

from typing import Any

from pydantic import BaseModel


class ResourceStartEvent(BaseModel):
    """Emitted when a resource tool call begins."""

    artifact_type: str
    resource_type: str
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ResourceProgressEvent(BaseModel):
    """Emitted during streaming of tool call arguments."""

    artifact_type: str
    resource_type: str
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ResourceErrorEvent(BaseModel):
    """Emitted when a resource tool call fails."""

    artifact_type: str
    resource_type: str
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str
    error_stage: str | None = (
        None  # "arg_parse" | "tool_resolve" | "tool_execute" | "result_parse"
    )
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
