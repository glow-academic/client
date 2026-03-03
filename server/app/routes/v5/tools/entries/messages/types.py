"""Messages entry types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateMessageResponse(BaseModel):
    id: UUID
    created_at: datetime


class GetMessageResponse(BaseModel):
    id: UUID
    run_id: UUID
    role: str
    created_at: datetime
    active: bool
    mcp: bool
    generated: bool
