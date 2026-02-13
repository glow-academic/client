"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.sql.types import (
    QGetRequestLimitsV4Item,
)


class SearchRequestLimitsApiRequest(BaseModel):
    """Request for searching request limits."""

    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] | None = Field(default_factory=list)


class SearchRequestLimitsApiResponse(BaseModel):
    """Response for searching request limits."""

    items: list[QGetRequestLimitsV4Item] | None = None


class SearchRequestLimitsSqlParams(BaseModel):
    """SQL parameters for search request limits."""

    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] | None = Field(default_factory=list)

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
        )


class SearchRequestLimitsSqlRow(BaseModel):
    """SQL row for search request limits."""

    items: list[QGetRequestLimitsV4Item] | None = None


class SearchRequestLimitsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    # Artifact boolean filters
    profile: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.profile,
        )
