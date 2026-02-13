"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchAgentsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    department_ids: list[UUID] = []
    tool_ids: list[UUID] = []
    instruction_ids: list[UUID] = []
    model_ids: list[UUID] = []
    prompt_ids: list[UUID] = []
    # Artifact boolean filters
    agent: bool = False
    setting: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.department_ids,
            self.tool_ids,
            self.instruction_ids,
            self.model_ids,
            self.prompt_ids,
            self.agent,
            self.setting,
        )
