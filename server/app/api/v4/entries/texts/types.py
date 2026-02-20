"""Canonical texts entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class TextsEntryData(BaseModel):
    """Canonical texts entry fields. All optional for streaming support."""

    id: str | None = None
    content: str | None = None
    content_hash: str | None = None
    created_at: str | None = None
