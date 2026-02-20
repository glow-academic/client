"""Canonical problems entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ProblemsEntryData(BaseModel):
    """Canonical problems entry fields. All optional for streaming support."""

    created_at: str | None = None
    type: str | None = None
    message: str | None = None
    id: str | None = None
    session_id: str | None = None
