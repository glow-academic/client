"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class GetSimulationPositionsV4Item(BaseModel):
    """Simulation position item returned from get endpoint."""

    id: UUID | None = None
    simulation_id: UUID | None = None
    value: int | None = None
    generated: bool | None = None
    mcp: bool | None = None


class GetSimulationPositionsApiRequest(BaseModel):
    """Request for getting simulation positions by simulation IDs."""

    simulation_ids: list[UUID]


class GetSimulationPositionsApiResponse(BaseModel):
    """Response for getting simulation positions."""

    items: list[GetSimulationPositionsV4Item] | None = Field(default_factory=list)


class GetSimulationPositionsSqlParams(BaseModel):
    """SQL parameters for get simulation positions."""

    simulation_ids: list[UUID]

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.simulation_ids,)


class GetSimulationPositionsSqlRow(BaseModel):
    """SQL row for get simulation positions."""

    items: list[GetSimulationPositionsV4Item] | None = None


class SearchSimulationPositionsApiRequest(BaseModel):
    """Request for searching simulation positions."""

    simulation_id: UUID | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] | None = Field(default_factory=list)


class SearchSimulationPositionsApiResponse(BaseModel):
    """Response for searching simulation positions."""

    items: list[GetSimulationPositionsV4Item] | None = Field(default_factory=list)


class SearchSimulationPositionsSqlParams(BaseModel):
    """SQL parameters for search simulation positions."""

    simulation_id: UUID | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] | None = Field(default_factory=list)

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.simulation_id,
            self.limit_count,
            self.offset_count,
            self.exclude_ids or [],
        )


class SearchSimulationPositionsSqlRow(BaseModel):
    """SQL row for search simulation positions."""

    items: list[GetSimulationPositionsV4Item] | None = None


class SearchSimulationPositionsParams(BaseModel):
    simulation_id: UUID | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    # Artifact boolean filters
    cohort: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.simulation_id,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.cohort,
        )
