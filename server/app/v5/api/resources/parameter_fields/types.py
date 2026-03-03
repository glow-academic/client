"""Canonical parameter_fields resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ParameterFieldsResourceData(BaseModel):
    """Canonical parameter_fields resource fields. All optional for streaming support."""

    id: str | None = None
    field_id: str | None = None
    parameter_id: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None
    conditional_parameter_id: str | None = None
