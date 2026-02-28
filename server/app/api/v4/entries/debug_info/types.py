"""Canonical debug info entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class DebugInfoEntryData(BaseModel):
    """Canonical debug info entry fields. All optional for streaming support."""

    created_at: str | None = None
    content: str | None = None
    id: str | None = None
    call_id: str | None = None
    run_id: str | None = None


class CreateDebugInfoEntryRequest(BaseModel):
    run_id: UUID
    content: str = ""


class CreateDebugInfoEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateDebugInfoEntrySqlParams(BaseModel):
    run_id: UUID
    content: str = ""
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.content, self.mcp)


class CreateDebugInfoEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
