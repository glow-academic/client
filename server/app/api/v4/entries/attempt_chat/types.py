"""Canonical attempt chat entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class AttemptChatEntryData(BaseModel):
    """Canonical attempt chat entry fields. All optional for streaming support."""

    id: str | None = None
    attempt_id: str | None = None
    created_at: str | None = None
    title: str | None = None
    group_id: str | None = None
    chat_resolved_id: str | None = None
