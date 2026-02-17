"""Types for this resource endpoint."""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GetProblemStatementV4Item(BaseModel):
    """Problem statement item returned from get endpoint."""

    problem_statement_id: UUID | None = None
    name: str | None = None
    problem_statement: str | None = None
    generated: bool | None = None


class GetProblemStatementApiRequest(BaseModel):
    """Request for getting a problem statement by ID."""

    id: UUID


class GetProblemStatementApiResponse(BaseModel):
    """Response for getting a problem statement."""

    item: GetProblemStatementV4Item | None = None


class GetProblemStatementSqlParams(BaseModel):
    """SQL parameters for get problem statement."""

    id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.id,)


class GetProblemStatementSqlRow(BaseModel):
    """SQL row for get problem statement."""

    items: list[GetProblemStatementV4Item] | None = None


class SearchProblemStatementsParams(BaseModel):
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


class ProblemStatementsResourceData(BaseModel):
    """Canonical problem_statements resource fields. All optional for streaming support."""

    problem_statement_id: str | None = None
    name: str | None = None
    problem_statement: str | None = None
    generated: bool | None = None
