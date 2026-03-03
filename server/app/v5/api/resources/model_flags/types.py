"""Canonical model_flags resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ModelFlagsResourceData(BaseModel):
    """Canonical model_flags resource fields. All optional for streaming support."""

    id: str | None = None
    model_id: str | None = None
    flag_id: str | None = None
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    generated: bool | None = None
