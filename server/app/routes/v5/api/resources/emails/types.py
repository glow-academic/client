"""Canonical emails resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class EmailsResourceData(BaseModel):
    """Canonical emails resource fields. All optional for streaming support."""

    id: str | None = None
    email: str | None = None
    generated: bool | None = None
