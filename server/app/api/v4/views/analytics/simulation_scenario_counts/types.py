"""Types for simulation scenario counts helper."""

from uuid import UUID

from pydantic import BaseModel, Field


class SimulationScenarioCountItem(BaseModel):
    simulation_id: UUID
    scenario_count: int = 0


class GetSimulationScenarioCountsResponse(BaseModel):
    items: list[SimulationScenarioCountItem] = Field(default_factory=list)
