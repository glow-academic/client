"""Canonical attempt_practice entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class AttemptPracticeEntryData(BaseModel):
    """Canonical attempt_practice entry fields. All optional for streaming support."""

    attempt_id: str | None = None
    practice_id: str | None = None
    created_at: str | None = None


class CreateAttemptPracticeEntryRequest(BaseModel):
    run_id: UUID
    attempt_id: UUID
    practice_id: UUID


class CreateAttemptPracticeEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptPracticeEntrySqlParams(BaseModel):
    run_id: UUID
    attempt_id: UUID
    practice_id: UUID
    tool_id: UUID | None = None
    upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.attempt_id,
            self.practice_id,
            self.tool_id,
            self.upload_id,
            self.mcp,
        )


class CreateAttemptPracticeEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
