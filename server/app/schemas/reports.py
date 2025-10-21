"""Reports bundle schemas."""


from pydantic import BaseModel

from .analytics import MetricResponse
from .base import ScenarioMapping, SimulationMapping


class ProfileMetrics(BaseModel):
    """Profile metrics - each metric is a full MetricResponse object."""

    averageScore: MetricResponse
    completionPercentage: MetricResponse
    firstAttemptPassRate: MetricResponse
    highestScore: MetricResponse
    messagesPerSession: MetricResponse
    personaResponseTimes: MetricResponse
    sessionEfficiency: MetricResponse
    stagnationRate: MetricResponse
    timeSpent: MetricResponse
    totalAttempts: MetricResponse


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
