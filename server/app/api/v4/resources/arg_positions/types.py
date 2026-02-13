"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchArgPositionsParams(BaseModel):
    args_ids: list[UUID] = []
    limit_count: int | None = 100
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    # Artifact boolean filters
    tool: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.args_ids,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.tool,
        )
