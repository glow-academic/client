"""Canonical scenario_flags resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ScenarioFlagsResourceData(BaseModel):
    """Canonical scenario_flags resource fields. All optional for streaming support."""

    id: str | None = None
    scenario_id: str | None = None
    flag_id: str | None = None
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    generated: bool | None = None
