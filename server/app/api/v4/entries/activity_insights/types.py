"""Canonical activity insights entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ActivityInsightsEntryData(BaseModel):
    """Canonical activity insights entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    group_id: str | None = None
    content: str | None = None
