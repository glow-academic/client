"""Canonical attempt completion entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class AttemptCompletionEntryData(BaseModel):
    """Canonical attempt completion entry fields. All optional for streaming support."""

    id: str | None = None
    chat_id: str | None = None
    end_reason: str | None = None
    created_at: str | None = None
