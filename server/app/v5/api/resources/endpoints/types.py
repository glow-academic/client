"""Canonical endpoints resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class EndpointsResourceData(BaseModel):
    """Canonical endpoints resource fields. All optional for streaming support."""

    id: str | None = None
    base_url: str | None = None
    generated: bool | None = None
