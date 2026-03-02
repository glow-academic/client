"""Canonical test stop entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class TestStopEntryData(BaseModel):
    """Canonical test stop entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    invocation_id: str | None = None
    stopped: bool | None = None


class CreateTestStopEntryRequest(BaseModel):
    run_id: UUID
    invocation_id: UUID
    stopped: bool = False


class CreateTestStopEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateTestStopEntrySqlParams(BaseModel):
    run_id: UUID
    invocation_id: UUID
    stopped: bool = False
    tool_id: UUID | None = None
    upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.invocation_id, self.stopped, self.mcp)


class CreateTestStopEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
