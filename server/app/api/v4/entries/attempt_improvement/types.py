"""Canonical improvements entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ImprovementsEntryData(BaseModel):
    """Canonical improvements entry fields. All optional for streaming support."""

    improvement_id: str | None = None
    message_id: str | None = None
    name: str | None = None
    description: str | None = None
    created_at: str | None = None
