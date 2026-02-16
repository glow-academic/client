"""Unified event model for cohorts resource socket events."""

from app.api.v4.resources.cohorts.types import CohortsResourceData


class CohortsGenerationEvent(CohortsResourceData):
    """Unified socket event for cohorts generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    resource_type: str = "cohorts"
    resource_id: str | None = None
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
