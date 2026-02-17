"""Types for this resource endpoint."""

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

SuggestSource = Literal["all", "linked", "draft"]


class GetSimulationsV4Item(BaseModel):
    """Simulation item returned from get endpoint."""

    simulation_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    active: bool | None = None
    generated: bool | None = None


class GetSimulationsApiRequest(BaseModel):
    """Request for getting simulations by IDs."""

    ids: list[UUID] = []


class GetSimulationsApiResponse(BaseModel):
    """Response for getting simulations."""

    items: list[GetSimulationsV4Item] | None = None


class GetSimulationsSqlParams(BaseModel):
    """SQL parameters for get simulations."""

    ids: list[UUID] = []

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.ids,)


class GetSimulationsSqlRow(BaseModel):
    """SQL row for get simulations."""

    items: list[GetSimulationsV4Item] | None = None


class SearchSimulationsApiRequest(BaseModel):
    """Request for searching simulations."""

    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    draft_id: UUID | None = None
    suggest_source: SuggestSource | None = "all"
    exclude_ids: list[UUID] | None = Field(default_factory=list)


class SearchSimulationsApiResponse(BaseModel):
    """Response for searching simulations."""

    items: list[GetSimulationsV4Item] | None = Field(default_factory=list)


class SearchSimulationsSqlParams(BaseModel):
    """SQL parameters for search simulations."""

    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    draft_id: UUID | None = None
    suggest_source: str | None = "all"
    exclude_ids: list[UUID] | None = Field(default_factory=list)

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.draft_id,
            self.suggest_source,
            self.exclude_ids or [],
        )


class SearchSimulationsSqlRow(BaseModel):
    """SQL row for search simulations."""

    items: list[GetSimulationsV4Item] | None = None


class SearchSimulationsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    draft_id: UUID | None = None
    suggest_source: str | None = "all"
    exclude_ids: list[UUID] = []
    department_ids: list[UUID] = []
    scenario_ids: list[UUID] = []
    # Artifact boolean filters
    cohort: bool = False
    simulation: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.draft_id,
            self.suggest_source,
            self.exclude_ids,
            self.department_ids,
            self.scenario_ids,
            self.cohort,
            self.simulation,
        )


class SimulationsResourceData(BaseModel):
    """Canonical simulations resource fields. All optional for streaming support."""

    simulation_id: str | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    active: bool | None = None
    generated: bool | None = None
