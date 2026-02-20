"""Unified event model for audios entry socket events."""

from app.api.v4.entries.audios.types import AudiosEntryData


class AudiosGenerationEvent(AudiosEntryData):
    """Unified socket event for audios generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "audios"
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
