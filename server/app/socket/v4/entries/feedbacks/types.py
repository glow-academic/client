"""Unified event model for feedbacks entry socket events."""

from pydantic import BaseModel


class FeedbacksGenerationEvent(BaseModel):
    """Unified socket event for feedbacks generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "feedbacks"
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
    # Entry fields (canonical shape from FeedbackViewItem)
    feedback_id: str | None = None
    grade_id: str | None = None
    standard_id: str | None = None
    total: float | None = None
    feedback: str | None = None
    created_at: str | None = None
