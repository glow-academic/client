"""Canonical messages entry type — single source of truth for entry fields."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class MessagesEntryData(BaseModel):
    """Canonical messages entry fields. All optional for streaming support."""

    id: str | None = None
    run_id: str | None = None
    created_at: str | None = None
    role: str | None = None
    upload_id: str | None = None


class CreateMessagesEntrySqlParams(BaseModel):
    run_id: UUID
    role: str
    chat_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.role,
            self.chat_id,
            self.mcp,
        )


class CreateMessagesEntrySqlRow(BaseModel):
    id: UUID
    created_at: datetime


class CreateMessagesEntryResponse(BaseModel):
    id: UUID
    created_at: datetime
