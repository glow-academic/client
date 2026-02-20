"""Canonical persona entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class PersonaEntryData(BaseModel):
    """Canonical persona entry fields. All optional for streaming support."""

    id: str | None = None
    training_id: str | None = None
    created_at: str | None = None
