"""Canonical model_positions resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ModelPositionsResourceData(BaseModel):
    """Canonical model_positions resource fields. All optional for streaming support."""

    id: str | None = None
    model_id: str | None = None
    value: int | None = None
    generated: bool | None = None
