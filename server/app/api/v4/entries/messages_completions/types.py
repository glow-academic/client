"""Canonical messages completions entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class MessagesCompletionsEntryData(BaseModel):
    """Canonical messages completions entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    message_id: str | None = None
