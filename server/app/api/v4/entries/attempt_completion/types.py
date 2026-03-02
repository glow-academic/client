"""Canonical attempt completion entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class AttemptCompletionEntryData(BaseModel):
    """Canonical attempt completion entry fields. All optional for streaming support."""

    id: str | None = None
    chat_id: str | None = None
    end_reason: str | None = None
    created_at: str | None = None


class CreateAttemptCompletionEntryRequest(BaseModel):
    run_id: UUID
    chat_id: UUID
    end_reason: str = ""


class CreateAttemptCompletionEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptCompletionEntrySqlParams(BaseModel):
    run_id: UUID
    chat_id: UUID
    end_reason: str = ""
    tool_id: UUID | None = None
    upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.chat_id,
            self.end_reason,
            self.tool_id,
            self.upload_id,
            self.mcp,
        )


class CreateAttemptCompletionEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
