"""Canonical items resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ItemsResourceData(BaseModel):
    """Canonical items resource fields. All optional for streaming support."""

    id: str | None = None
    name: str | None = None
    description: str | None = None
    encrypted: bool | None = None
    position: int | None = None
    generated: bool | None = None
