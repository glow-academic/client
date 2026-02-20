"""Canonical conversations completions entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ConversationsCompletionsEntryData(BaseModel):
    """Canonical conversations completions entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    conversation_id: str | None = None
    end_reason: str | None = None
