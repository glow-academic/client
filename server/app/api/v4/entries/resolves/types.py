"""Canonical resolves entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class ResolvesEntryData(BaseModel):
    """Canonical resolves entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    problem_id: str | None = None
    resolved: bool | None = None


class CreateResolvesEntryRequest(BaseModel):
    run_id: UUID
    problem_id: UUID
    resolved: bool = False


class CreateResolvesEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateResolvesEntrySqlParams(BaseModel):
    run_id: UUID
    problem_id: UUID
    resolved: bool = False
    tool_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.problem_id, self.resolved, self.mcp)


class CreateResolvesEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
