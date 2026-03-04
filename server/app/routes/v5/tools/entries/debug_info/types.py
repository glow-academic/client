"""Debug info entry types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateDebugInfoResponse(BaseModel):
    id: UUID


class GetDebugInfoResponse(BaseModel):
    id: UUID
    created_at: datetime
    content: str
    active: bool
    generated: bool
    call_id: UUID
    mcp: bool
    run_id: UUID | None
