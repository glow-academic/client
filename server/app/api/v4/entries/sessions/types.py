"""Canonical sessions entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class SessionsEntryData(BaseModel):
    """Canonical sessions entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    profile_id: str | None = None
