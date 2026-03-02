"""Canonical test entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class TestEntryData(BaseModel):
    """Canonical test entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    infinite_mode: bool | None = None
    benchmark_id: str | None = None


class CreateTestEntryRequest(BaseModel):
    run_id: UUID
    infinite_mode: bool = False
    benchmark_id: UUID | None = None


class CreateTestEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateTestEntrySqlParams(BaseModel):
    run_id: UUID
    infinite_mode: bool = False
    benchmark_id: UUID | None = None
    tool_id: UUID | None = None
    upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.infinite_mode, self.benchmark_id, self.mcp)


class CreateTestEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
