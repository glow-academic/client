"""Canonical practice insights entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class PracticeInsightsEntryData(BaseModel):
    """Canonical practice insights entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    group_id: str | None = None
    content: str | None = None
