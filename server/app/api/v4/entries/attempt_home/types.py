"""Canonical attempt_home entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class AttemptHomeEntryData(BaseModel):
    """Canonical attempt_home entry fields. All optional for streaming support."""

    attempt_id: str | None = None
    home_id: str | None = None
    created_at: str | None = None


class CreateAttemptHomeEntryRequest(BaseModel):
    run_id: UUID
    attempt_id: UUID
    home_id: UUID


class CreateAttemptHomeEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptHomeEntrySqlParams(BaseModel):
    run_id: UUID
    attempt_id: UUID
    home_id: UUID
    tool_id: UUID | None = None
    upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.attempt_id,
            self.home_id,
            self.tool_id,
            self.upload_id,
            self.mcp,
        )


class CreateAttemptHomeEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
