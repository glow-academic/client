"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchParameterFieldsParams(BaseModel):
    parameter_ids: list[UUID] = []
    # Artifact boolean filters
    document: bool = False
    persona: bool = False
    scenario: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.parameter_ids,
            self.document,
            self.persona,
            self.scenario,
        )
