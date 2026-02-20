"""Canonical mutes entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class MutesEntryData(BaseModel):
    """Canonical mutes entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    conversation_id: str | None = None
    muted: bool | None = None
