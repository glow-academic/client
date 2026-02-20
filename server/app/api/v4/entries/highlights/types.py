"""Canonical highlights legacy entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class HighlightsLegacyEntryData(BaseModel):
    """Canonical highlights legacy entry fields. All optional for streaming support."""

    idx: int | None = None
    section: str | None = None
    created_at: str | None = None
    message_feedback_id: str | None = None
