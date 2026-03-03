"""Canonical names resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class NamesResourceData(BaseModel):
    """Canonical names resource fields. All optional for streaming support."""

    id: str | None = None
    name: str | None = None
    generated: bool | None = None
