"""Messages completions entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateMessagesCompletionsEntrySqlParams(BaseModel):
    session_id: UUID | None = None
    message_id: UUID
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.message_id,
            self.session_id,
            self.mcp,
        )


class CreateMessagesCompletionsEntrySqlRow(BaseModel):
    id: UUID


class CreateMessagesCompletionsEntryResponse(BaseModel):
    id: UUID


class CreateMessagesCompletionResponse(BaseModel):
    id: UUID


class GetMessagesCompletionResponse(BaseModel):
    id: UUID
    message_id: UUID
    session_id: UUID | None
    created_at: datetime
    active: bool
    mcp: bool
    generated: bool
