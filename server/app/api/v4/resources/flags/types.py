"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchFlagsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    # Artifact boolean filters
    agent: bool = False
    auth: bool = False
    cohort: bool = False
    department: bool = False
    document: bool = False
    eval: bool = False
    field: bool = False
    model: bool = False
    parameter: bool = False
    persona: bool = False
    profile: bool = False
    provider: bool = False
    rubric: bool = False
    scenario: bool = False
    setting: bool = False
    simulation: bool = False
    tool: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.agent,
            self.auth,
            self.cohort,
            self.department,
            self.document,
            self.eval,
            self.field,
            self.model,
            self.parameter,
            self.persona,
            self.profile,
            self.provider,
            self.rubric,
            self.scenario,
            self.setting,
            self.simulation,
            self.tool,
        )
