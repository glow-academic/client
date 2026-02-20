"""Canonical home training entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class HomeTrainingEntryData(BaseModel):
    """Canonical home training entry fields. All optional for streaming support."""

    id: str | None = None
    home_id: str | None = None
    training_id: str | None = None
    created_at: str | None = None
