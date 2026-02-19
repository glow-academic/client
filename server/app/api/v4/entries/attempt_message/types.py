"""Canonical simulation messages entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class SimulationMessagesEntryData(BaseModel):
    """Canonical simulation messages entry fields. All optional for streaming support."""

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
