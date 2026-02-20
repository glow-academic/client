"""Canonical scenario drafts entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ScenarioDraftsEntryData(BaseModel):
    """Canonical scenario drafts entry fields. All optional for streaming support."""

    id: str | None = None
    version: int | None = None
    created_at: str | None = None
    group_id: str | None = None
