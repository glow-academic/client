"""Unified event model for texts entry socket events."""

from app.api.v4.entries.texts.types import TextsEntryData


class TextsGenerationEvent(TextsEntryData):
    """Unified socket event for texts generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "texts"
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
