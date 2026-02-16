"""Canonical simulation_positions resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class SimulationPositionsResourceData(BaseModel):
    """Canonical simulation_positions resource fields. All optional for streaming support."""

    id: str | None = None
    simulation_id: str | None = None
    value: int | None = None
    generated: bool | None = None
    mcp: bool | None = None
