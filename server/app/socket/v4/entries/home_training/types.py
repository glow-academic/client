"""Unified event model for home_training entry socket events."""

from app.api.v4.entries.home_training.types import HomeTrainingEntryData


class HomeTrainingGenerationEvent(HomeTrainingEntryData):
    """Unified socket event for home_training generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "home_training"
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
