"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchProfilesParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    department_ids: list[UUID] = []
    cohort_ids: list[UUID] = []
    role_ids: list[UUID] = []
    # Artifact boolean filters
    profile: bool = False
    setting: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.department_ids,
            self.cohort_ids,
            self.role_ids,
            self.profile,
            self.setting,
        )
