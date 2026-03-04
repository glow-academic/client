"""Entry types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateTestCompletionResponse(BaseModel):
    id: UUID


class GetTestCompletionResponse(BaseModel):
    id: UUID
    created_at: datetime
    generated: bool
    mcp: bool
    active: bool
    invocation_id: UUID
    end_reason: str
    call_id: UUID
