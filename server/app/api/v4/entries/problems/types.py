"""Canonical problems entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class ProblemsEntryData(BaseModel):
    """Canonical problems entry fields. All optional for streaming support."""

    created_at: str | None = None
    type: str | None = None
    message: str | None = None
    id: str | None = None
    session_id: str | None = None


class CreateProblemsEntryRequest(BaseModel):
    run_id: UUID
    type: str
    message: str = ""


class CreateProblemsEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateProblemsEntrySqlParams(BaseModel):
    run_id: UUID
    type: str
    message: str = ""
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.type, self.message, self.mcp)


class CreateProblemsEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
