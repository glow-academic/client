"""Canonical hints entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class HintsEntryData(BaseModel):
    """Canonical hints entry fields. All optional for streaming support."""

    hint_id: str | None = None
    message_id: str | None = None
    hint: str | None = None
    idx: int | None = None
    created_at: str | None = None


class CreateAttemptHintEntryRequest(BaseModel):
    run_id: UUID
    message_id: UUID
    hint: str = ""


class CreateAttemptHintEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptHintEntrySqlParams(BaseModel):
    run_id: UUID
    message_id: UUID
    hint: str = ""
    tool_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.message_id,
            self.hint,
            self.tool_id,
            self.mcp,
        )


class CreateAttemptHintEntrySqlRow(BaseModel):
    entry_id: UUID
    entry_call_id: UUID
    entry_message_id: UUID
