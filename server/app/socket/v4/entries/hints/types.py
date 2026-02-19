"""Unified event model for hints entry socket events."""

from app.api.v4.entries.attempt_hint.types import HintsEntryData


class HintsGenerationEvent(HintsEntryData):
    """Unified socket event for hints generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "hints"
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
