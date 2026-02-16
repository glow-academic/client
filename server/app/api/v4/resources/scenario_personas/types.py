"""Canonical scenario_personas resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ScenarioPersonasResourceData(BaseModel):
    """Canonical scenario_personas resource fields. All optional for streaming support."""

    id: str | None = None
    scenario_id: str | None = None
    persona_id: str | None = None
    generated: bool | None = None
