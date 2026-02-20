"""Canonical emulations entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class EmulationsEntryData(BaseModel):
    """Canonical emulations entry fields. All optional for streaming support."""

    id: str | None = None
    grant_id: str | None = None
    created_at: str | None = None
    session_id: str | None = None
