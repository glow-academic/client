"""Unified event model for responses entry socket events."""

from pydantic import BaseModel


class ResponsesGenerationEvent(BaseModel):
    """Unified socket event for responses generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "responses"
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
    # Entry fields (canonical shape from ResponseViewItem)
    response_id: str | None = None
    chat_id: str | None = None
    question_id: str | None = None
    option_id: str | None = None
    completed: bool | None = None
    created_at: str | None = None
