"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.sql.types import QGetStandardGroupsV4Item


class GetStandardGroupsApiRequest(BaseModel):
    """Request for getting standard_groups by IDs."""

    ids: list[UUID]


class GetStandardGroupsApiResponse(BaseModel):
    """Response for getting standard_groups."""

    items: list[QGetStandardGroupsV4Item] = []


class SearchStandardGroupsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    # Artifact boolean filters
    rubric: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.rubric,
        )


class StandardGroupsResourceData(BaseModel):
    """Canonical standard_groups resource fields. All optional for streaming support."""

    standard_group_id: str | None = None
    name: str | None = None
    description: str | None = None
    points: float | None = None
    pass_points: float | None = None
