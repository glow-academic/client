"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchModelsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    department_ids: list[UUID] = []
    provider_ids: list[UUID] = []
    temperature_level_ids: list[UUID] = []
    reasoning_level_ids: list[UUID] = []
    quality_ids: list[UUID] = []
    voice_ids: list[UUID] = []
    modality_ids: list[UUID] = []
    # Artifact boolean filters
    agent: bool = False
    model: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.department_ids,
            self.provider_ids,
            self.temperature_level_ids,
            self.reasoning_level_ids,
            self.quality_ids,
            self.voice_ids,
            self.modality_ids,
            self.agent,
            self.model,
        )
