"""Pydantic models for attempt_* internal events.

Every model includes `sid: str` as the routing field.
These types are used at emit sites to validate payloads
before sending via internal_sio.emit(..., model.model_dump(mode="json")).
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


# --- Lifecycle ---
class AttemptStartedData(BaseModel):
    sid: str
    attempt_id: str
    training_entry_id: str


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


# --- User ---
class AttemptUserStartData(BaseModel):
    sid: str
    chat_id: str
    item_id: str


class AttemptUserProgressData(BaseModel):
    sid: str
    chat_id: str
    item_id: str
    transcript: str


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
