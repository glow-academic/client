"""Canonical colors resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ColorsResourceData(BaseModel):
    """Canonical colors resource fields. All optional for streaming support."""

    id: str | None = None
    name: str | None = None
    description: str | None = None
    hex_code: str | None = None
    generated: bool | None = None
