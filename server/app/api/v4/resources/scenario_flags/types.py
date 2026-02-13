"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchScenarioFlagsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    scenario_ids: list[UUID] = []
    flag_ids: list[UUID] = []
    # Artifact boolean filters
    simulation: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.scenario_ids,
            self.flag_ids,
            self.simulation,
        )
