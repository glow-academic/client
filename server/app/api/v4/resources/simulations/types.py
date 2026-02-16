"""Canonical simulations resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class SimulationsResourceData(BaseModel):
    """Canonical simulations resource fields. All optional for streaming support."""

    simulation_id: str | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    active: bool | None = None
    generated: bool | None = None
