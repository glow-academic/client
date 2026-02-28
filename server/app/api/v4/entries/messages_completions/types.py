"""Canonical messages completions entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class MessagesCompletionsEntryData(BaseModel):
    """Canonical messages completions entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    message_id: str | None = None


class CreateMessagesCompletionsEntrySqlParams(BaseModel):
    session_id: UUID
    message_id: UUID
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.message_id,
            self.mcp,
        )


class CreateMessagesCompletionsEntrySqlRow(BaseModel):
    id: UUID


class CreateMessagesCompletionsEntryResponse(BaseModel):
    id: UUID
