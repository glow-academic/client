"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetObjectiveV4Item(BaseModel):
    """Objective item returned from get endpoint."""

    objective_id: UUID | None = None
    objective: str | None = None
    generated: bool | None = None


class GetObjectiveApiRequest(BaseModel):
    """Request for getting an objective by ID."""

    id: UUID


class GetObjectiveApiResponse(BaseModel):
    """Response for getting an objective."""

    item: GetObjectiveV4Item | None = None


class GetObjectiveSqlParams(BaseModel):
    """SQL parameters for get objective."""

    id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.id,)


class GetObjectiveSqlRow(BaseModel):
    """SQL row for get objective."""

    items: list[GetObjectiveV4Item] | None = None


class SearchObjectivesParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    # Artifact boolean filters
    scenario: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.scenario,
        )


class ObjectivesResourceData(BaseModel):
    """Canonical objectives resource fields. All optional for streaming support."""

    objective_id: str | None = None
    objective: str | None = None
    generated: bool | None = None
