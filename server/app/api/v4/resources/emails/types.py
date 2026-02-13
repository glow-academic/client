"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.sql.types import (
    QGetEmailsV4Item,
)


class SearchEmailsApiRequest(BaseModel):
    """Request for searching emails."""

    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] | None = Field(default_factory=list)


class SearchEmailsApiResponse(BaseModel):
    """Response for searching emails."""

    items: list[QGetEmailsV4Item] | None = None


class SearchEmailsSqlParams(BaseModel):
    """SQL parameters for search emails."""

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


class SearchEmailsSqlRow(BaseModel):
    """SQL row for search emails."""

    items: list[QGetEmailsV4Item] | None = None


class SearchEmailsParams(BaseModel):
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
