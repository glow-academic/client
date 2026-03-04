"""Messages completions entry types."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


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
