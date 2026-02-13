"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchRubricsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    department_ids: list[UUID] = []
    simulation_rubric: bool | None = None
    video_rubric: bool | None = None
    # Artifact boolean filters
    rubric: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.department_ids,
            self.simulation_rubric,
            self.video_rubric,
            self.rubric,
        )
