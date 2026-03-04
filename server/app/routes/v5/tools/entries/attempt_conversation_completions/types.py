"""Entry types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateAttemptConversationCompletionsResponse(BaseModel):
    id: UUID


class GetAttemptConversationCompletionsResponse(BaseModel):
    id: UUID
    created_at: datetime
    generated: bool
    mcp: bool
    active: bool
    conversation_id: UUID
    end_reason: str
    call_id: UUID
