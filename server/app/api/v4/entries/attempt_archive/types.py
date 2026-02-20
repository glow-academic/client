"""Canonical attempt archive entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class AttemptArchiveEntryData(BaseModel):
    """Canonical attempt archive entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    attempt_id: str | None = None
    archived: bool | None = None
