"""Canonical conversations completions entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class ConversationsCompletionsEntryData(BaseModel):
    """Canonical conversations completions entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    conversation_id: str | None = None
    end_reason: str | None = None


class CreateConversationsCompletionsEntryRequest(BaseModel):
    run_id: UUID
    conversation_id: UUID
    end_reason: str = ""


class CreateConversationsCompletionsEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateConversationsCompletionsEntrySqlParams(BaseModel):
    run_id: UUID
    conversation_id: UUID
    end_reason: str = ""
    tool_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.conversation_id, self.end_reason, self.mcp)


class CreateConversationsCompletionsEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
