"""Canonical examples resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ExamplesResourceData(BaseModel):
    """Canonical examples resource fields. All optional for streaming support."""

    id: str | None = None
    example: str | None = None
    idx: int | None = None
    generated: bool | None = None
