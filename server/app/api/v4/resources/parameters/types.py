"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchParametersParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    p_persona_parameter: bool | None = None
    p_document_parameter: bool | None = None
    p_scenario_parameter: bool | None = None
    p_video_parameter: bool | None = None
    suggest_source: str | None = "all"
    exclude_ids: list[UUID] = []
    department_ids: list[UUID] = []
    # Artifact boolean filters
    document: bool = False
    parameter: bool = False
    persona: bool = False
    scenario: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.p_persona_parameter,
            self.p_document_parameter,
            self.p_scenario_parameter,
            self.p_video_parameter,
            self.suggest_source,
            self.exclude_ids,
            self.department_ids,
            self.document,
            self.parameter,
            self.persona,
            self.scenario,
        )
