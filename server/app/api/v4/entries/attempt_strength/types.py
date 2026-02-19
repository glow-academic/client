"""Canonical strengths entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class StrengthsEntryData(BaseModel):
    """Canonical strengths entry fields. All optional for streaming support."""

    strength_id: str | None = None
    message_id: str | None = None
    name: str | None = None
    description: str | None = None
    created_at: str | None = None
