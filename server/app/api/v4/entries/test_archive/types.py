"""Canonical test archive entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class TestArchiveEntryData(BaseModel):
    """Canonical test archive entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    test_id: str | None = None
    archived: bool | None = None


class CreateTestArchiveEntryRequest(BaseModel):
    run_id: UUID
    test_id: UUID
    archived: bool = False


class CreateTestArchiveEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateTestArchiveEntrySqlParams(BaseModel):
    run_id: UUID
    test_id: UUID
    archived: bool = False
    tool_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.test_id, self.archived, self.mcp)


class CreateTestArchiveEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
