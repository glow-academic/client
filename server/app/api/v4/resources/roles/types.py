"""Canonical roles resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class RolesResourceData(BaseModel):
    """Canonical roles resource fields. All optional for streaming support."""

    id: str | None = None
    role: str | None = None
    name: str | None = None
    description: str | None = None
    icon_value: str | None = None
    color_hex: str | None = None
