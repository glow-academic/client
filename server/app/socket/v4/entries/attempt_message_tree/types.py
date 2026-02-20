"""Unified event model for attempt_message_tree entry socket events."""

from app.api.v4.entries.attempt_message_tree.types import AttemptMessageTreeEntryData


class AttemptMessageTreeGenerationEvent(AttemptMessageTreeEntryData):
    """Unified socket event for attempt_message_tree generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "attempt_message_tree"
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
