"""Canonical reasoning_levels resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ReasoningLevelsResourceData(BaseModel):
    """Canonical reasoning_levels resource fields. All optional for streaming support."""

    id: str | None = None
    reasoning_level: str | None = None
    generated: bool | None = None
