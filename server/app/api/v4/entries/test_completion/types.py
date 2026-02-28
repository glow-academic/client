"""Canonical test completion entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class TestCompletionEntryData(BaseModel):
    """Canonical test completion entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    invocation_id: str | None = None
    end_reason: str | None = None


class CreateTestCompletionEntryRequest(BaseModel):
    run_id: UUID
    invocation_id: UUID
    end_reason: str = ""


class CreateTestCompletionEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateTestCompletionEntrySqlParams(BaseModel):
    run_id: UUID
    invocation_id: UUID
    end_reason: str = ""
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.invocation_id, self.end_reason, self.mcp)


class CreateTestCompletionEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
