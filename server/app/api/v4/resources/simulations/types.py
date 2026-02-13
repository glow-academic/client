"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class GetSimulationV4Item(BaseModel):
    """Simulation item returned from get endpoint."""

    simulation_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    time_limit: int | None = None  # Not populated by SQL; artifact layer computes
    generated: bool | None = None


class GetSimulationApiRequest(BaseModel):
    """Request for getting a simulation by ID."""

    id: UUID


class GetSimulationApiResponse(BaseModel):
    """Response for getting a simulation."""

    item: GetSimulationV4Item | None = None


class GetSimulationSqlParams(BaseModel):
    """SQL parameters for get simulation."""

    id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.id,)


class GetSimulationSqlRow(BaseModel):
    """SQL row for get simulation."""

    items: list[GetSimulationV4Item] | None = None


class GetSimulationsBatchV4Item(BaseModel):
    """Simulation batch item with full context data."""

    simulation_id: UUID | None = None
    title: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    time_limit: int | None = None
    active: bool | None = None
    practice_simulation: bool | None = None


class GetSimulationsBatchApiRequest(BaseModel):
    """Request for getting simulations by IDs (batch)."""

    ids: list[UUID] | None = Field(default_factory=list)


class GetSimulationsBatchApiResponse(BaseModel):
    """Response for getting simulations batch."""

    items: list[GetSimulationsBatchV4Item] | None = None


class GetSimulationsBatchSqlParams(BaseModel):
    """SQL parameters for get simulations batch."""

    ids: list[UUID] | None = Field(default_factory=list)

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.ids,)


class GetSimulationsBatchSqlRow(BaseModel):
    """SQL row for get simulations batch."""

    items: list[GetSimulationsBatchV4Item] | None = None


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
            self.cohort,
            self.simulation,
        )
