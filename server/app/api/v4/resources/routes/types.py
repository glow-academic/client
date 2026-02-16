"""Canonical routes resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class RoutesResourceData(BaseModel):
    """Canonical routes resource fields. All optional for streaming support."""

    id: str | None = None
    route: str | None = None
    generated: bool | None = None
