"""Canonical conversations entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class ConversationsEntryData(BaseModel):
    """Canonical conversations entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    chat_id: str | None = None


class CreateConversationsEntryRequest(BaseModel):
    run_id: UUID
    chat_id: UUID


class CreateConversationsEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateConversationsEntrySqlParams(BaseModel):
    run_id: UUID
    chat_id: UUID
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.chat_id, self.mcp)


class CreateConversationsEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
