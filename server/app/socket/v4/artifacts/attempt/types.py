"""Types for attempt simulation socket events.

Defines payload and event types for the attempt simulation WebSocket handlers:
- AttemptMessagePayload: Send a message during an attempt (legacy - complex payload)
- AttemptGradePayload: Grade an attempt
- AttemptSendPayload: Simplified send message (new - server looks up context from chat_id)

Entry types are predefined per handler (not in payload):
- message.py: ['contents', 'hints'] - Message response tools
- grade.py: All tools from agent's config chain (no client-side filtering)
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)

# =============================================================================
# Entry type constants (predefined per handler, not in payload)
# =============================================================================

ATTEMPT_MESSAGE_ENTRY_TYPES = ["contents", "hints"]


# =============================================================================
# Client-to-Server Event Payloads
# =============================================================================


class AttemptMessagePayload(BaseModel):
    """Request payload for attempt_message WebSocket event.

    Sends a user message during an active simulation chat.
    Agent is resolved from pre-stored group (created at training start).
    """

    simulation_id: UUID
    chat_id: UUID
    message: str
    voice_mode: bool = False
    upload_id: UUID | None = None  # For voice audio uploads
    group_id: UUID | None = None  # For regeneration (uses existing group)


class AttemptGradePayload(BaseModel):
    """Request payload for attempt_grade WebSocket event.

    Ends the simulation and triggers grading.
    Agent is resolved from pre-stored group (created at training start).
    """

    simulation_id: UUID
    attempt_id: UUID
    chat_id: UUID | None = None  # Optional - grade specific chat or all


# =============================================================================
# Server-to-Client Event Types
# =============================================================================


class AttemptMessageSentEvent(BaseModel):
    """Server-to-client event: attempt_message_sent.

    Emitted when a user message is received and assistant placeholder created.
    """

    artifact_type: str = "attempt"
    chat_id: str
    user_message_id: str
    run_id: str | None = None
    group_id: str | None = None


class AttemptGradedEvent(BaseModel):
    """Server-to-client event: attempt_graded.

    Emitted when simulation grading completes.
    """

    artifact_type: str = "attempt"
    simulation_id: str
    attempt_id: str
    chat_id: str | None = None
    grade_id: str | None = None
    score: int | None = None
    passed: bool | None = None
    feedback: str | None = None


class AttemptProgressEvent(GenerationProgressEvent):
    """Server-to-client event: attempt_progress.

    Emitted during message generation to stream tokens.
    """

    artifact_type: str = "attempt"
    delta: str | None = None
    accumulated_content: str | None = None


class AttemptCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: attempt_complete.

    Emitted when message generation completes and is saved to DB.
    Terminal event for a generation turn — client uses this to clear sending state.
    """

    artifact_type: str = "attempt"
    chat_id: str
    final_content: str | None = None
    completed: bool = True


class AttemptErrorEvent(GenerationErrorEvent):
    """Server-to-client event: attempt_error.

    Emitted when an error occurs during attempt generation.
    """

    artifact_type: str = "attempt"


# =============================================================================
# New Unified attempt_* Event Contract
# =============================================================================


# -----------------------------------------------------------------------------
# Client-to-Server Payloads (Simplified)
# -----------------------------------------------------------------------------


class AttemptJoinPayload(BaseModel):
    """Request payload for attempt_join WebSocket event.

    Joins a chat room for real-time updates.
    """

    chat_id: UUID


class AttemptLeavePayload(BaseModel):
    """Request payload for attempt_leave WebSocket event.

    Leaves a chat room.
    """

    chat_id: UUID


class AttemptStopPayload(BaseModel):
    """Request payload for attempt_stop WebSocket event.

    Stops the current message generation.
    """

    chat_id: UUID


class AttemptEndPayload(BaseModel):
    """Request payload for attempt_end WebSocket event.

    Ends a chat and moves to next chat or completes attempt.
    """

    chat_id: UUID
    previous_chat_id: UUID | None = None  # Reuse grade from previous attempt's chat


class AttemptEndAllPayload(BaseModel):
    """Request payload for attempt_end_all WebSocket event.

    Ends all chats in an attempt.
    """

    attempt_id: UUID
    previous_chat_map: dict[str, str] | None = None  # {scenario_id: previous_chat_id}


class AttemptAudioStartPayload(BaseModel):
    """Request payload for attempt_audio_start WebSocket event.

    Starts a voice session for a chat.
    """

    chat_id: UUID


class AttemptAudioStopPayload(BaseModel):
    """Request payload for attempt_audio_stop WebSocket event.

    Stops the voice session for a chat.
    """

    chat_id: UUID


class AttemptAudioFramePayload(BaseModel):
    """Request payload for attempt_audio_frame WebSocket event.

    Sends an audio frame to the server.
    """

    audio: bytes


class AttemptMicMutePayload(BaseModel):
    """Request payload for attempt_mic_mute WebSocket event.

    Toggles microphone mute state.
    """

    muted: bool


class AttemptResponseSubmitPayload(BaseModel):
    """Request payload for attempt_response_submit WebSocket event.

    Submits a response to a video question.
    """

    chat_id: UUID
    question_id: UUID
    option_ids: list[UUID]


# -----------------------------------------------------------------------------
# Server-to-Client Events (Unified)
# -----------------------------------------------------------------------------


class AttemptJoinedEvent(BaseModel):
    """Server-to-client event: attempt_joined.

    Emitted when a client successfully joins a chat room.
    """

    chat_id: str
    success: bool


class AttemptUserStartEvent(BaseModel):
    """Server-to-client event: attempt_user_start.

    Emitted when user speech is detected in voice mode.
    """

    chat_id: str
    item_id: str


class AttemptUserDeltaEvent(BaseModel):
    """Server-to-client event: attempt_user_delta.

    Emitted during voice transcription with incremental updates.
    """

    chat_id: str
    item_id: str
    transcript: str


class AttemptUserCompleteEvent(BaseModel):
    """Server-to-client event: attempt_user_complete.

    Emitted when user message is finalized (text or voice).
    """

    chat_id: str
    message_id: str  # User message ID (not a generation run_id)
    content: str
    created_at: str
    persona_id: str | None = None


class AttemptAssistantStartEvent(BaseModel):
    """Server-to-client event: attempt_assistant_start.

    Emitted when assistant message generation starts.
    """

    chat_id: str
    message_id: str
    created_at: str
    persona_id: str | None = None


class AttemptAssistantDeltaEvent(BaseModel):
    """Server-to-client event: attempt_assistant_delta.

    Emitted during message generation with accumulated content.
    """

    chat_id: str
    message_id: str
    content: str  # accumulated content


class AttemptAssistantAudioEvent(BaseModel):
    """Server-to-client event: attempt_assistant_audio.

    Emitted with audio chunks during voice mode.
    """

    chat_id: str
    audio: bytes


class AttemptAssistantCompleteEvent(BaseModel):
    """Server-to-client event: attempt_assistant_complete.

    Emitted when assistant message generation is complete.
    """

    chat_id: str
    message_id: str
    content: str
    created_at: str | None = None
    persona_id: str | None = None


class AttemptStoppedEvent(BaseModel):
    """Server-to-client event: attempt_stopped.

    Emitted when message generation is stopped.
    """

    chat_id: str
    success: bool
    message: str | None = None


class AttemptChatEndedEvent(BaseModel):
    """Server-to-client event: attempt_chat_ended.

    Emitted when a chat is ended.
    """

    chat_id: str
    next_chat_id: str | None = None
    is_attempt_finished: bool | None = None
    grade_id: str | None = None


class AttemptEndedEvent(BaseModel):
    """Server-to-client event: attempt_ended.

    Emitted when an entire attempt is ended.
    """

    attempt_id: str
    success: bool
    message: str | None = None


class AttemptAudioReadyEvent(BaseModel):
    """Server-to-client event: attempt_audio_ready.

    Emitted when voice session is ready.
    """

    chat_id: str
    success: bool
    message: str | None = None


class AttemptAudioEndedEvent(BaseModel):
    """Server-to-client event: attempt_audio_ended.

    Emitted when voice session is ended.
    """

    chat_id: str
    success: bool
    message: str | None = None


class AttemptGradingProgressEvent(BaseModel):
    """Server-to-client event: attempt_grading_progress.

    Emitted during grading with progress updates.
    """

    chat_id: str
    type: str  # "start", "standard_graded", "summary_recorded", "complete"
    standard_group_name: str | None = None
    score: int | None = None
    completed_count: int | None = None
    total_count: int | None = None
    feedback_preview: str | None = None
    summary: str | None = None


class AttemptHintProgressEvent(BaseModel):
    """Server-to-client event: attempt_hint_progress.

    Emitted during hint generation (auto-triggered after message).
    """

    chat_id: str
    message_id: str
    type: str  # "start", "progress", "complete"
    hints_count: int | None = None
    hints: list[dict[str, Any]] | None = None


class AttemptContentProgressEvent(BaseModel):
    """Server-to-client event: attempt_content_progress.

    Emitted when the create_content tool completes, providing the
    persona_id and content so the client can render immediately.
    """

    chat_id: str
    message_id: str
    content_id: str
    content: str
    persona_id: str | None = None


class AttemptResponseResultEvent(BaseModel):
    """Server-to-client event: attempt_response_result.

    Emitted after a video question response is submitted.
    """

    success: bool
    message: str | None = None
    is_correct: bool | None = None
    all_correct: bool | None = None


class AttemptUnifiedErrorEvent(BaseModel):
    """Server-to-client event: attempt_error.

    Unified error event for all attempt operations.
    """

    group_id: str | None = None
    run_id: str | None = None
    type: str | None = None  # "send", "stop", "end", "audio", "quiz", "hint"
    message: str
