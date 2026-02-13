"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetOptionV4Item(BaseModel):
    """Option item returned from get endpoint."""

    option_id: UUID | None = None
    option_text: str | None = None
    is_correct: bool | None = None
    generated: bool | None = None


class GetOptionsApiRequest(BaseModel):
    """Request for getting options by IDs."""

    ids: list[UUID]


class GetOptionsApiResponse(BaseModel):
    """Response for getting options."""

    items: list[GetOptionV4Item] = []


class SearchOptionsParams(BaseModel):
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
