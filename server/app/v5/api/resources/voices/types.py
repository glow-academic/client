"""Canonical voices resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class VoicesResourceData(BaseModel):
    """Canonical voices resource fields. All optional for streaming support."""

    id: str | None = None
    voice: str | None = None
    generated: bool | None = None
