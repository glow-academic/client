"""Unified event model for strengths entry socket events."""

from pydantic import BaseModel


class StrengthsGenerationEvent(BaseModel):
    """Unified socket event for strengths generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "strengths"
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
    # Entry fields (canonical shape from StrengthViewItem)
    strength_id: str | None = None
    message_id: str | None = None
    name: str | None = None
    description: str | None = None
    created_at: str | None = None
