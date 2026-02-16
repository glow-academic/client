"""Canonical objectives resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ObjectivesResourceData(BaseModel):
    """Canonical objectives resource fields. All optional for streaming support."""

    objective_id: str | None = None
    objective: str | None = None
    generated: bool | None = None
