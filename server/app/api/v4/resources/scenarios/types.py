"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchScenariosParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    department_ids: list[UUID] = []
    suggest_source: str | None = "all"
    exclude_ids: list[UUID] = []
    persona_ids: list[UUID] = []
    parameter_ids: list[UUID] = []
    parent_ids: list[UUID] = []
    is_root: bool | None = None
    problem_statement_enabled: bool | None = None
    objectives_enabled: bool | None = None
    video_enabled: bool | None = None
    images_enabled: bool | None = None
    questions_enabled: bool | None = None
    # Artifact boolean filters
    scenario: bool = False
    simulation: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.department_ids,
            self.suggest_source,
            self.exclude_ids,
            self.persona_ids,
            self.parameter_ids,
            self.parent_ids,
            self.is_root,
            self.problem_statement_enabled,
            self.objectives_enabled,
            self.video_enabled,
            self.images_enabled,
            self.questions_enabled,
            self.scenario,
            self.simulation,
        )
