"""Canonical conditional_parameters resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ConditionalParametersResourceData(BaseModel):
    """Canonical conditional_parameters resource fields. All optional for streaming support."""

    id: str | None = None
    parameter_id: str | None = None
    generated: bool | None = None
