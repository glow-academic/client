"""Canonical scenarios resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ScenariosResourceData(BaseModel):
    """Canonical scenarios resource fields. All optional for streaming support."""

    scenario_id: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None
    problem_statement_enabled: bool | None = None
    objectives_enabled: bool | None = None
    video_enabled: bool | None = None
    images_enabled: bool | None = None
    questions_enabled: bool | None = None
    persona_ids: list[str] | None = None
    parameter_field_ids: list[str] | None = None
    parameter_ids: list[str] | None = None
