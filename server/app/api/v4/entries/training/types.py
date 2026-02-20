"""Canonical training entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class TrainingEntryData(BaseModel):
    """Canonical training entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    infinite_mode: bool | None = None
