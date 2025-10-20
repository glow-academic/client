"""Reports bundle schemas."""

from typing import Any

from pydantic import BaseModel

from .base import ScenarioMapping, SimulationMapping


class ProfileMetrics(BaseModel):
    """Profile metrics."""

    averageScore: float
    highestScore: float
    totalAttempts: int
    averageMessages: float
    averageTime: float


class ProfileDataEnhanced(BaseModel):
    """Enhanced profile data row."""

    profileId: str
    firstName: str
    lastName: str
    alias: str | None
    role: str
    metrics: ProfileMetrics


class ReportsBundleResponse(BaseModel):
    """Reports bundle response with entity mappings."""

    data: list[ProfileDataEnhanced]
    scenario_mapping: ScenarioMapping
    simulation_mapping: SimulationMapping

