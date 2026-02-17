"""Unified event model for improvements entry socket events."""

from pydantic import BaseModel


class ImprovementsGenerationEvent(BaseModel):
    """Unified socket event for improvements generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "improvements"
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
    # Entry fields (canonical shape from ImprovementViewItem)
    improvement_id: str | None = None
    message_id: str | None = None
    name: str | None = None
    description: str | None = None
    created_at: str | None = None
