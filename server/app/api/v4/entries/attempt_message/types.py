"""Canonical simulation messages entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class SimulationMessagesEntryData(BaseModel):
    """Canonical simulation messages entry fields. All optional for streaming support."""

    message_id: str | None = None
    chat_id: str | None = None
    attempt_id: str | None = None
    type: str | None = None
    created_at: str | None = None
    completed: bool | None = None
    runs_id: str | None = None
    text_id: str | None = None
    audio_id: str | None = None
    history_content: str | None = None


class CreateAttemptMessageEntryRequest(BaseModel):
    run_id: UUID
    chat_id: UUID
    message_id: UUID | None = None


class CreateAttemptMessageEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptMessageEntrySqlParams(BaseModel):
    run_id: UUID
    chat_id: UUID
    message_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.chat_id,
            self.message_id,
            self.mcp,
        )


class CreateAttemptMessageEntrySqlRow(BaseModel):
    entry_id: UUID
    entry_call_id: UUID
    entry_message_id: UUID
