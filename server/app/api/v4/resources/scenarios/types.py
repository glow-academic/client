"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchScenariosParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    user_department_ids: list[UUID] = []
    suggest_source: str | None = "all"
    exclude_ids: list[UUID] = []
    # Artifact boolean filters
    scenario: bool = False
    simulation: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.user_department_ids,
            self.suggest_source,
            self.exclude_ids,
            self.scenario,
            self.simulation,
        )
