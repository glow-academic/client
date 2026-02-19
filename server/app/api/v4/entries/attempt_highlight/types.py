"""Canonical highlights entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class HighlightsEntryData(BaseModel):
    """Canonical highlights entry fields. All optional for streaming support."""

    highlight_id: str | None = None
    strength_id: str | None = None
    section: str | None = None
    idx: int | None = None
    created_at: str | None = None
