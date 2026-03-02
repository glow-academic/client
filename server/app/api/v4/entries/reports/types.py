"""Canonical reports entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class ReportsEntryData(BaseModel):
    """Canonical reports entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    upload_id: str | None = None


class CreateReportsEntryRequest(BaseModel):
    run_id: UUID
    upload_id: UUID


class CreateReportsEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateReportsEntrySqlParams(BaseModel):
    run_id: UUID
    upload_id: UUID
    tool_id: UUID | None = None
    text_upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.upload_id, self.mcp)


class CreateReportsEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
