"""Canonical conversations entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ConversationsEntryData(BaseModel):
    """Canonical conversations entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    chat_id: str | None = None
