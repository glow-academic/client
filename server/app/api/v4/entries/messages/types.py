"""Canonical messages entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class MessagesEntryData(BaseModel):
    """Canonical messages entry fields. All optional for streaming support."""

    id: str | None = None
    run_id: str | None = None
    created_at: str | None = None
    role: str | None = None
    text_id: str | None = None
    call_id: str | None = None
