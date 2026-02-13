"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.sql.types import QGetStandardsV4Item


class GetStandardsApiRequest(BaseModel):
    """Request for getting standards by IDs."""

    ids: list[UUID]


class GetStandardsApiResponse(BaseModel):
    """Response for getting standards."""

    items: list[QGetStandardsV4Item] = []


class SearchStandardsParams(BaseModel):
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
