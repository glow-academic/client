"""Canonical simulation_availability resource type — single source of truth for resource fields."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class SimulationAvailabilityV4Item(BaseModel):
    """Simulation availability item returned from get/search endpoints."""

    id: UUID | None = None
    simulation_id: UUID | None = None
    time: str | None = None
    type: str | None = None
    generated: bool | None = None
    mcp: bool | None = None


class GetSimulationAvailabilityApiRequest(BaseModel):
    """Request for getting simulation availability by IDs."""

    ids: list[UUID]


class GetSimulationAvailabilityApiResponse(BaseModel):
    """Response for getting simulation availability."""

    items: list[SimulationAvailabilityV4Item] | None = Field(default_factory=list)


class GetSimulationAvailabilitySqlParams(BaseModel):
    """SQL parameters for get simulation availability."""

    ids: list[UUID]

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.ids,)


class GetSimulationAvailabilitySqlRow(BaseModel):
    """SQL row for get simulation availability."""

    items: list[SimulationAvailabilityV4Item] | None = None


class SearchSimulationAvailabilityApiRequest(BaseModel):
    """Request for searching simulation availability."""

    simulation_ids: list[UUID] | None = Field(default_factory=list)
    availability_type: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] | None = Field(default_factory=list)
    cohort: bool | None = False


class SearchSimulationAvailabilityApiResponse(BaseModel):
    """Response for searching simulation availability."""

    items: list[SimulationAvailabilityV4Item] | None = Field(default_factory=list)


class SearchSimulationAvailabilitySqlParams(BaseModel):
    """SQL parameters for search simulation availability."""

    simulation_ids: list[UUID] | None = Field(default_factory=list)
    availability_type: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] | None = Field(default_factory=list)
    cohort: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.simulation_ids or [],
            self.availability_type,
            self.limit_count,
            self.offset_count,
            self.exclude_ids or [],
            self.cohort,
        )


class SearchSimulationAvailabilitySqlRow(BaseModel):
    """SQL row for search simulation availability."""

    items: list[SimulationAvailabilityV4Item] | None = None


class SimulationAvailabilityResourceData(BaseModel):
    """Canonical simulation_availability resource fields. All optional for streaming support."""

    id: str | None = None
    simulation_id: str | None = None
    time: str | None = None
    type: str | None = None
    generated: bool | None = None
    mcp: bool | None = None
