"""Canonical values resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ValuesResourceData(BaseModel):
    """Canonical values resource fields. All optional for streaming support."""

    id: str | None = None
    value: str | None = None
    generated: bool | None = None
