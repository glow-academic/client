"""Canonical slugs resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class SlugsResourceData(BaseModel):
    """Canonical slugs resource fields. All optional for streaming support."""

    id: str | None = None
    value: str | None = None
    generated: bool | None = None
