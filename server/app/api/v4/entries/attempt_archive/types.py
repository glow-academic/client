"""Canonical attempt archive entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class AttemptArchiveEntryData(BaseModel):
    """Canonical attempt archive entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    attempt_id: str | None = None
    archived: bool | None = None


class CreateAttemptArchiveEntryRequest(BaseModel):
    run_id: UUID
    attempt_id: UUID
    archived: bool = False


class CreateAttemptArchiveEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptArchiveEntrySqlParams(BaseModel):
    run_id: UUID
    attempt_id: UUID
    archived: bool = False
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.attempt_id,
            self.archived,
            self.mcp,
        )


class CreateAttemptArchiveEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
