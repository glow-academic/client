"""Unified event model for videos entry socket events."""

from app.api.v4.entries.videos.types import VideosEntryData


class VideosGenerationEvent(VideosEntryData):
    """Unified socket event for videos generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "videos"
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
