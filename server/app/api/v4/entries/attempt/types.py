"""Canonical attempt entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class AttemptEntryData(BaseModel):
    """Canonical attempt entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    infinite_mode: bool | None = None
    practice: bool | None = None
