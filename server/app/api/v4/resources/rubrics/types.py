"""Canonical rubrics resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class RubricsResourceData(BaseModel):
    """Canonical rubrics resource fields. All optional for streaming support."""

    id: str | None = None
    name: str | None = None
    description: str | None = None
    standard_group_ids: list[str] | None = None
