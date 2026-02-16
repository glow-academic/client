"""Canonical personas resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class PersonasResourceData(BaseModel):
    """Canonical personas resource fields. All optional for streaming support."""

    persona_id: str | None = None
    name: str | None = None
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    image_model: bool | None = None
    instructions: str | None = None
    examples: list[str] | None = None
    generated: bool | None = None
    parameter_field_ids: list[str] | None = None
    parameter_ids: list[str] | None = None
