"""Canonical contents entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class ContentsEntryData(BaseModel):
    """Canonical contents entry fields. All optional for streaming support."""

    content_id: str | None = None
    message_id: str | None = None
    content: str | None = None
    persona_id: str | None = None
    idx: int | None = None
    created_at: str | None = None


class CreateAttemptContentEntryRequest(BaseModel):
    run_id: UUID
    message_id: UUID
    content: str = ""
    persona_id: UUID | None = None


class CreateAttemptContentEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptContentEntrySqlParams(BaseModel):
    run_id: UUID
    message_id: UUID
    content: str = ""
    persona_id: UUID | None = None
    tool_id: UUID | None = None
    upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.message_id,
            self.content,
            self.persona_id,
            self.tool_id,
            self.upload_id,
            self.mcp,
        )


class CreateAttemptContentEntrySqlRow(BaseModel):
    entry_id: UUID
    entry_call_id: UUID
    entry_message_id: UUID
