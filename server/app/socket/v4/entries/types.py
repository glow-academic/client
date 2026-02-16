"""Base event types for per-entry socket events.

Shared across all entry types. Per-entry complete event types
are defined in each entry's types.py module.
"""

from typing import Any

from pydantic import BaseModel


class EntryCompleteEvent(BaseModel):
    """Emitted when an entry tool call completes."""

    artifact_type: str
    entry_type: str
    entry_id: str | None = None
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class EntryErrorEvent(BaseModel):
    """Emitted when an entry tool call fails."""

    artifact_type: str
    entry_type: str
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
