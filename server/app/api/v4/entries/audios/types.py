"""Canonical audios entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class AudiosEntryData(BaseModel):
    """Canonical audios entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    call_id: str | None = None
    upload_id: str | None = None
    message_id: str | None = None
    length_seconds: int | None = None
