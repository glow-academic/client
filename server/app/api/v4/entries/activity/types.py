"""Canonical activity entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ActivityEntryData(BaseModel):
    """Canonical activity entry fields. All optional for streaming support."""

    last_active: str | None = None
    created_at: str | None = None
    id: str | None = None
    session_id: str | None = None
