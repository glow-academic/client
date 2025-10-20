"""Home overview schemas."""

from typing import Literal

from pydantic import BaseModel

from .base import SimulationMapping, StandardGroupsMapping, StandardsMapping


class HomeSimulationItem(BaseModel):
    """Home simulation item."""

    viewMode: Literal["ta", "instructional"]
    id: str
    simulationTitle: str
    simulationDescription: str | None = None
    simulationName: str
    timeLimit: int | None = None
    numSessions: int
    highestScore: float | None = None
    standard_groups: dict[str, list[str]]
    color: str | None = None
    icon: str | None = None
    hasPassed: bool | None = None
    passRate: float | None = None
    status: Literal["not-started", "in-progress", "passed"] | None = None
    completionPct: float | None = None
    passedCount: int | None = None
    inProgressCount: int | None = None
    notStartedCount: int | None = None
    passPct: float | None = None


class AttemptHistoryRow(BaseModel):
    """Attempt history row."""

    attemptId: str
    date: str
    profileId: str
    profileName: str
    simulationName: str
    numScenarios: int | None = None
    numScenariosCompleted: int
    infiniteMode: bool
    timeLimit: int | None = None  # simulation time limit in seconds (from simulation_time_limits)
    personaNames: list[str]
    personaColors: list[str]
    score: int | None = None
    simulation_id: str
    scenario_ids: list[str]
    scenario_titles: list[str]
    isArchived: bool
    showView: bool
    showContinue: bool
    practiceSimulation: bool
    passPct: int | None = None
    department_id: str


AttemptHistoryResponse = list[AttemptHistoryRow]


class HomeOverviewResponse(BaseModel):
    """Home overview response with mappings and history."""

    mode: Literal["ta", "instructional", "empty"]
    hasData: bool
    items: list[HomeSimulationItem]
    history: AttemptHistoryResponse
    standard_groups_mapping: StandardGroupsMapping
    standards_mapping: StandardsMapping
    simulation_mapping: SimulationMapping

