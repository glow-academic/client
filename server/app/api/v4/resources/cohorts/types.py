"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class QGetCohortsV4Item(BaseModel):
    """Cohort item returned from get endpoint."""

    cohort_id: UUID | None = None
    title: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None


class GetCohortsApiRequest(BaseModel):
    """Request for getting cohorts by IDs."""

    ids: list[UUID] | None = Field(default_factory=list)


class GetCohortsApiResponse(BaseModel):
    """Response for getting cohorts."""

    items: list[QGetCohortsV4Item] | None = None


class GetCohortsSqlParams(BaseModel):
    """SQL parameters for get cohorts."""

    ids: list[UUID] | None = Field(default_factory=list)

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.ids,)


class GetCohortsSqlRow(BaseModel):
    """SQL row for get cohorts."""

    items: list[QGetCohortsV4Item] | None = None


class SearchCohortsApiRequest(BaseModel):
    """Request for searching cohorts."""

    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] | None = Field(default_factory=list)


class SearchCohortsApiResponse(BaseModel):
    """Response for searching cohorts."""

    items: list[QGetCohortsV4Item] | None = None


class SearchCohortsSqlParams(BaseModel):
    """SQL parameters for search cohorts."""

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


class SearchCohortsSqlRow(BaseModel):
    """SQL row for search cohorts."""

    items: list[QGetCohortsV4Item] | None = None


class SearchCohortsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    department_ids: list[UUID] = []
    # Artifact boolean filters
    cohort: bool = False
    profile: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.department_ids,
            self.cohort,
            self.profile,
        )
