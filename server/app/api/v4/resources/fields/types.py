"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchFieldsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    user_department_ids: list[UUID] = []
    draft_id: UUID | None = None
    suggest_source: str | None = "all"
    exclude_ids: list[UUID] = []
    # Artifact boolean filters
    field: bool = False
    parameter: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.user_department_ids,
            self.draft_id,
            self.suggest_source,
            self.exclude_ids,
            self.field,
            self.parameter,
        )
