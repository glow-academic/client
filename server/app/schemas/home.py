"""Home overview schemas."""

from typing import Literal

from pydantic import BaseModel

from .base import SimulationMapping, StandardGroupsMapping, StandardsMapping


class HomeSimulationItem(BaseModel):
    """Home simulation item."""

    viewMode: Literal["home"]
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
    simulationId: str
    scenarioId: str
    completedAt: str
    gradedAt: str | None = None
    gradePercent: float | None = None
    passed: bool | None = None
    numMessagesTotal: int | None = None
    timeTakenSeconds: int | None = None


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

