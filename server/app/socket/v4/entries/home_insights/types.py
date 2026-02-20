"""Unified event model for home_insights entry socket events."""

from app.api.v4.entries.home_insights.types import HomeInsightsEntryData


class HomeInsightsGenerationEvent(HomeInsightsEntryData):
    """Unified socket event for home_insights generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "home_insights"
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
