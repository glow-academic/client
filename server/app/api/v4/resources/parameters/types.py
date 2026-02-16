"""Canonical parameters resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ParametersResourceData(BaseModel):
    """Canonical parameters resource fields. All optional for streaming support."""

    parameter_id: str | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    generated: bool | None = None
    persona_parameter: bool | None = None
    document_parameter: bool | None = None
    scenario_parameter: bool | None = None
    video_parameter: bool | None = None
    conditional: bool | None = None
    field_ids: list[str] | None = None
