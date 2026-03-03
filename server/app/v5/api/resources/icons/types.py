"""Canonical icons resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class IconsResourceData(BaseModel):
    """Canonical icons resource fields. All optional for streaming support."""

    id: str | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    generated: bool | None = None
