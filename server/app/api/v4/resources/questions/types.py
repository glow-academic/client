"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetQuestionV4Item(BaseModel):
    """Question item returned from get endpoint."""

    question_id: UUID | None = None
    question_text: str | None = None
    allow_multiple: bool | None = None
    generated: bool | None = None


class GetQuestionApiRequest(BaseModel):
    """Request for getting a question by ID."""

    id: UUID


class GetQuestionApiResponse(BaseModel):
    """Response for getting a question."""

    item: GetQuestionV4Item | None = None


class GetQuestionSqlParams(BaseModel):
    """SQL parameters for get question."""

    id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.id,)


class GetQuestionSqlRow(BaseModel):
    """SQL row for get question."""

    items: list[GetQuestionV4Item] | None = None


class SearchQuestionsParams(BaseModel):
    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    exclude_ids: list[UUID] = []
    # Artifact boolean filters
    scenario: bool = False

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.exclude_ids,
            self.scenario,
        )
