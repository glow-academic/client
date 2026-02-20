"""Canonical runs entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class RunsEntryData(BaseModel):
    """Canonical runs entry fields. All optional for streaming support."""

    created_at: str | None = None
    id: str | None = None
    group_id: str | None = None
