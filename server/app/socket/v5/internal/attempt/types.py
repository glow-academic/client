"""Pydantic models for attempt_* internal events.

Every model includes `sid: str` as the routing field.
These types are used at emit sites to validate payloads
before sending via internal_sio.emit(..., model.model_dump(mode="json")).
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


# --- Lifecycle ---
class AttemptStartRequestData(BaseModel):
    """Internal bus payload for triggering attempt_start."""

    sid: str
    attempt_id: str


class AttemptChatRequestData(BaseModel):
    """Internal bus payload for triggering attempt_chat (create mode from generation_complete)."""

    sid: str
    attempt_id: str
    attempt_chat_id: str
    profile_id: str


class GenerateRequestData(BaseModel):
    """Internal bus payload for triggering the generate pipeline from attempt handlers."""

    sid: str
    profile_id: str
    artifact_type: str
    artifact_id: str
    resource_types: list[str]
    save: bool = True
    draft_id: str | None = None
    user_instructions: list[str] | None = None
    run_id: str | None = None
    group_id: str | None = None
    modality: str = "call"
    extra_messages: list[dict[str, str]] | None = None
    metadata: dict[str, Any] | None = None


class AttemptProceedData(BaseModel):
    """Internal bus payload for attempt_proceed — shared core logic.

    Fields:
        completed_chat_id: If set, mark this chat completed before proceeding.
        complete_all: If True, mark all remaining chats completed → emit attempt_ended.
    """

    sid: str
    attempt_id: str
    draft_id: str | None = None
    force_proceed: bool = False
    completed_chat_id: str | None = None
    complete_all: bool = False


class AttemptStartedData(BaseModel):
    sid: str
    attempt_id: str
    chat_entry_id: str


class AttemptEndedData(BaseModel):
    sid: str
    attempt_id: str
    success: bool
    all_scenarios_complete: bool = False
    message: str | None = None


class AttemptErrorData(BaseModel):
    sid: str
    error_type: str
    message: str
    chat_id: str | None = None


# --- Chat ---
class AttemptChatStartedData(BaseModel):
    sid: str
    attempt_id: str
    chat_id: str


class AttemptChatEndedData(BaseModel):
    sid: str
    chat_id: str
    is_attempt_finished: bool | None = None
    grade_id: str | None = None


class AttemptJoinedData(BaseModel):
    sid: str
    chat_id: str
    success: bool = True


# --- User (received — pre-DB, emitted by client/audio handlers) ---
class AttemptUserReceivedStartData(BaseModel):
    """A user message is starting. DB: creates message shell."""

    sid: str
    chat_id: str
    run_id: str
    profile_id: str
    item_id: str | None = None  # Audio only (VAD item)
    rooms: list[str] | None = None


class AttemptUserReceivedProgressData(BaseModel):
    """User message streaming (audio transcription). No DB write."""

    sid: str
    chat_id: str
    item_id: str | None = None
    transcript: str = ""
    rooms: list[str] | None = None


class AttemptUserReceivedCompleteData(BaseModel):
    """User message finalized. DB: writes content + marks complete."""

    sid: str
    chat_id: str
    run_id: str
    content: str
    item_id: str | None = None
    rooms: list[str] | None = None


# --- User (confirmed — post-DB, emitted to server/ layer) ---
class AttemptUserStartData(BaseModel):
    sid: str
    chat_id: str
    message_id: str
    created_at: str
    item_id: str | None = None
    rooms: list[str] | None = None


class AttemptUserProgressData(BaseModel):
    sid: str
    chat_id: str
    item_id: str | None = None
    transcript: str = ""
    rooms: list[str] | None = None


class AttemptUserCompleteData(BaseModel):
    sid: str
    chat_id: str
    message_id: str
    content: str
    created_at: str
    rooms: list[str] | None = None
    item_id: str | None = None


# --- Assistant ---
class AttemptAssistantStartData(BaseModel):
    sid: str
    chat_id: str
    message_id: str
    created_at: str


class AttemptAssistantProgressData(BaseModel):
    sid: str
    chat_id: str
    content_type: str  # "delta" | "audio"
    content: str | None = None
    audio: Any | None = None


class AttemptAssistantCompleteData(BaseModel):
    sid: str
    chat_id: str
    message_id: str
    content: str | None = None


class AttemptAssistantHintsData(BaseModel):
    sid: str
    chat_id: str
    hints: list[dict[str, Any]]


# --- Grade ---
class AttemptGradeStartData(BaseModel):
    sid: str
    chat_id: str
    grade_id: str | None = None


class AttemptGradeProgressData(BaseModel):
    sid: str
    chat_id: str
    grade_id: str | None = None
    resource_type: str | None = None
    entry: dict[str, Any] | None = None


class AttemptGradeCompleteData(BaseModel):
    sid: str
    chat_id: str
    grade_id: str | None = None


# --- Control ---
class AttemptStoppedData(BaseModel):
    sid: str
    chat_id: str
    success: bool
    message: str | None = None
    rooms: list[str] | None = None


# --- Audio ---
class AttemptAudioReadyData(BaseModel):
    sid: str
    chat_id: str
    success: bool = True
    message: str | None = None


class AttemptAudioEndedData(BaseModel):
    sid: str
    chat_id: str
    success: bool = True
    message: str | None = None


# --- Response ---
class AttemptResponseResultData(BaseModel):
    sid: str
    success: bool
    message: str | None = None
    is_correct: bool | None = None
