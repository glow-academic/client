"""Canonical thresholds resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ThresholdsResourceData(BaseModel):
    """Canonical thresholds resource fields. All optional for streaming support."""

    id: str | None = None
    value: int | None = None
    generated: bool | None = None
