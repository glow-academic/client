"""Canonical attempt entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class AttemptEntryData(BaseModel):
    """Canonical attempt entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    infinite_mode: bool | None = None
    practice: bool | None = None


class CreateAttemptEntryRequest(BaseModel):
    run_id: UUID
    infinite_mode: bool = False
    num_chats: int = 1
    user_persona_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    practice: bool = False
    profiles_id: UUID | None = None


class CreateAttemptEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptEntrySqlParams(BaseModel):
    run_id: UUID
    infinite_mode: bool = False
    num_chats: int = 1
    user_persona_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    practice: bool = False
    profiles_id: UUID | None = None
    tool_id: UUID | None = None
    upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.infinite_mode,
            self.num_chats,
            self.user_persona_id,
            self.name,
            self.description,
            self.practice,
            self.profiles_id,
            self.tool_id,
            self.upload_id,
            self.mcp,
        )


class CreateAttemptEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
