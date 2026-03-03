"""Canonical chat entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ChatEntryData(BaseModel):
    """Canonical chat entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
