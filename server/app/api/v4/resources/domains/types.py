"""Canonical domains resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class DomainsResourceData(BaseModel):
    """Canonical domains resource fields. All optional for streaming support."""

    id: str | None = None
    resource: str | None = None
    creatable: bool | None = None
    generated: bool | None = None
