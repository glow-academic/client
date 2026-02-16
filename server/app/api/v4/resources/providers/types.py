"""Canonical providers resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ProvidersResourceData(BaseModel):
    """Canonical providers resource fields. All optional for streaming support."""

    id: str | None = None
    value: str | None = None
    name: str | None = None
    description: str | None = None
    endpoint: str | None = None
    key: str | None = None
    active: bool | None = None
    generated: bool | None = None
