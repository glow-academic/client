"""Entry types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateAttemptCompletionResponse(BaseModel):
    id: UUID


class GetAttemptCompletionResponse(BaseModel):
    id: UUID
    chat_id: UUID
    end_reason: str
    created_at: datetime
    active: bool
    generated: bool
    mcp: bool
    call_id: UUID
