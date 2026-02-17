"""Unified event model for contents entry socket events."""

from pydantic import BaseModel


class ContentsGenerationEvent(BaseModel):
    """Unified socket event for contents generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "contents"
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
    # Entry fields (canonical shape from ContentViewItem)
    content_id: str | None = None
    message_id: str | None = None
    content: str | None = None
    persona_id: str | None = None
    idx: int | None = None
    created_at: str | None = None
