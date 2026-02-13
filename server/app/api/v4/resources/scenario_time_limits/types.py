"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchScenarioTimeLimitsParams(BaseModel):
    scenario_ids: list[UUID] = []
    negative: bool | None = None
    # Artifact boolean filters
    simulation: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.scenario_ids,
            self.negative,
            self.simulation,
        )
