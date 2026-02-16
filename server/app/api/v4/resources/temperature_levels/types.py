"""Canonical temperature_levels resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class TemperatureLevelsResourceData(BaseModel):
    """Canonical temperature_levels resource fields. All optional for streaming support."""

    id: str | None = None
    temperature: float | None = None
    generated: bool | None = None
