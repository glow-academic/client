"""Unified event model for reasoning_levels resource socket events."""

from app.api.v4.resources.reasoning_levels.types import ReasoningLevelsResourceData


class ReasoningLevelsGenerationEvent(ReasoningLevelsResourceData):
    """Unified socket event for reasoning_levels generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    resource_type: str = "reasoning_levels"
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
