"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class SearchDocumentsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    department_ids: list[UUID] = []
    draft_id: UUID | None = None
    suggest_source: str | None = "all"
    exclude_ids: list[UUID] = []
    upload_ids: list[UUID] = []
    text_ids: list[UUID] = []
    image_ids: list[UUID] = []
    template: bool | None = None
    # Artifact boolean filters
    document: bool = False
    scenario: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.department_ids,
            self.draft_id,
            self.suggest_source,
            self.exclude_ids,
            self.upload_ids,
            self.text_ids,
            self.image_ids,
            self.template,
            self.document,
            self.scenario,
        )
