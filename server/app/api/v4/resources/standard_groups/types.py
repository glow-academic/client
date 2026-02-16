"""Canonical standard_groups resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class StandardGroupsResourceData(BaseModel):
    """Canonical standard_groups resource fields. All optional for streaming support."""

    standard_group_id: str | None = None
    name: str | None = None
    description: str | None = None
    points: float | None = None
    pass_points: float | None = None
