"""Canonical scenario_positions resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ScenarioPositionsResourceData(BaseModel):
    """Canonical scenario_positions resource fields. All optional for streaming support."""

    id: str | None = None
    scenario_id: str | None = None
    value: int | None = None
    generated: bool | None = None
