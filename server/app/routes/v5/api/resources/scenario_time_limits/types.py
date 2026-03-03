"""Canonical scenario_time_limits resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ScenarioTimeLimitsResourceData(BaseModel):
    """Canonical scenario_time_limits resource fields. All optional for streaming support."""

    id: str | None = None
    scenario_id: str | None = None
    time_limit_seconds: int | None = None
    generated: bool | None = None
