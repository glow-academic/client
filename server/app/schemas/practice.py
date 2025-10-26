"""Practice overview schemas."""

from typing import Literal

from pydantic import BaseModel

from .base import (ParameterItemMapping, ParameterMapping, PersonaMapping,
                   ScenarioMapping, SimulationMapping, StandardGroupsMapping,
                   StandardsMapping)
from .home import AttemptHistoryResponse


class PracticeFilters(BaseModel):
    """Practice filter request schema - simplified to profile-only."""

    profileId: str
    departmentIds: list[str] | None = None


class PracticeSimulationItem(BaseModel):
    """Practice simulation item."""

    viewMode: Literal["practice"]
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
    cohortName: str | None = None
    updatedAt: str | None = None
    lastActivityTs: str | None = None
    hasActivity: bool | None = None


class PracticeOverviewResponse(BaseModel):
    """Practice overview response with mappings and history."""

    mode: Literal["practice"]
    hasData: bool
    items: list[PracticeSimulationItem]
    history: AttemptHistoryResponse
    standard_groups_mapping: StandardGroupsMapping
    standards_mapping: StandardsMapping
    simulation_mapping: SimulationMapping
    scenario_mapping: ScenarioMapping
    persona_mapping: PersonaMapping
    parameter_mapping: ParameterMapping
    parameter_item_mapping: ParameterItemMapping
