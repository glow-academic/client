"""Typed event models for simulation_positions resource generation."""

from typing import Any

from pydantic import BaseModel


class SimulationPositionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: simulation_positions_generation_complete."""

    artifact_type: str
    resource_type: str = "simulation_positions"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
