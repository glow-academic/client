"""Canonical groups resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class GroupsResourceData(BaseModel):
    """Canonical groups resource fields. All optional for streaming support."""

    id: str | None = None
    generated: bool | None = None
