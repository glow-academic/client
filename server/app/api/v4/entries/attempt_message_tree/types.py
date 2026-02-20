"""Canonical attempt message tree entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class AttemptMessageTreeEntryData(BaseModel):
    """Canonical attempt message tree entry fields. All optional for streaming support."""

    parent_id: str | None = None
    child_id: str | None = None
    created_at: str | None = None
