"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchGroupRubricsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    groups_ids: list[UUID] = []
    rubric_ids: list[UUID] = []
    # Artifact boolean filters
    eval: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.groups_ids,
            self.rubric_ids,
            self.eval,
        )
