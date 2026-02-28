"""Canonical mutes entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class MutesEntryData(BaseModel):
    """Canonical mutes entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    conversation_id: str | None = None
    muted: bool | None = None


class CreateMutesEntryRequest(BaseModel):
    run_id: UUID
    conversation_id: UUID
    muted: bool = False


class CreateMutesEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateMutesEntrySqlParams(BaseModel):
    run_id: UUID
    conversation_id: UUID
    muted: bool = False
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.conversation_id, self.muted, self.mcp)


class CreateMutesEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
