"""Canonical entries resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class EntriesResourceData(BaseModel):
    """Canonical entries resource fields. All optional for streaming support."""

    id: str | None = None
    entry: str | None = None
    generated: bool | None = None
