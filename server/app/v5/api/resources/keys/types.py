"""Canonical keys resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class KeysResourceData(BaseModel):
    """Canonical keys resource fields. All optional for streaming support."""

    id: str | None = None
    key_id: str | None = None
    key: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None
