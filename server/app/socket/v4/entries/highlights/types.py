"""Unified event model for highlights entry socket events."""

from pydantic import BaseModel


class HighlightsGenerationEvent(BaseModel):
    """Unified socket event for highlights generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "highlights"
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
    # Entry fields (canonical shape from HighlightViewItem)
    highlight_id: str | None = None
    strength_id: str | None = None
    section: str | None = None
    idx: int | None = None
    created_at: str | None = None
