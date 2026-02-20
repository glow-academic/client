"""Canonical bindings entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class BindingsEntryData(BaseModel):
    """Canonical bindings entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
