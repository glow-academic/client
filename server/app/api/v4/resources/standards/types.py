"""Canonical standards resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class StandardsResourceData(BaseModel):
    """Canonical standards resource fields. All optional for streaming support."""

    standard_id: str | None = None
    standard_group_id: str | None = None
    name: str | None = None
    description: str | None = None
    points: float | None = None
