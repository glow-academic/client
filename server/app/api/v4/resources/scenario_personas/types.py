"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchScenarioPersonasParams(BaseModel):
    scenario_ids: list[UUID] = []
    persona_ids: list[UUID] = []
    # Artifact boolean filters
    simulation: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.scenario_ids,
            self.persona_ids,
            self.simulation,
        )
