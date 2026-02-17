"""Unified event model for simulation_messages entry socket events."""

from pydantic import BaseModel


class SimulationMessagesGenerationEvent(BaseModel):
    """Unified socket event for simulation_messages generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    entry_type: str = "simulation_messages"
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
    # Entry fields (canonical shape from MessageViewItem)
    message_id: str | None = None
    chat_id: str | None = None
    attempt_id: str | None = None
    type: str | None = None
    created_at: str | None = None
    completed: bool | None = None
    runs_id: str | None = None
    text_id: str | None = None
    audio_id: str | None = None
    history_content: str | None = None
