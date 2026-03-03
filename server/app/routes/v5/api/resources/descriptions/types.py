"""Canonical descriptions resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class DescriptionsResourceData(BaseModel):
    """Canonical descriptions resource fields. All optional for streaming support."""

    id: str | None = None
    description: str | None = None
    generated: bool | None = None
