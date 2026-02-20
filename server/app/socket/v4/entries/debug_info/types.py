"""Unified event model for debug_info entry socket events."""

from app.api.v4.entries.debug_info.types import DebugInfoEntryData


class DebugInfoGenerationEvent(DebugInfoEntryData):
    """Unified socket event for debug_info generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "debug_info"
    entry_id: str | None = None
    group_id: str | None = None
    run_id: str | None = None
    # Completion
    success: bool | None = None
    # Error
    message: str | None = None
    error_stage: str | None = None
    # Tool call tracking
    tool_call_id: str | None = None
    tool_name: str | None = None
    # Streaming
    arguments_delta: str | None = None
