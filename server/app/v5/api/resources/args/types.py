"""Canonical args resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ArgsResourceData(BaseModel):
    """Canonical args resource fields. All optional for streaming support."""

    id: str | None = None
    name: str | None = None
    description: str | None = None
    field_type: str | None = None
    required: bool | None = None
    default_value: str | None = None
    generated: bool | None = None
