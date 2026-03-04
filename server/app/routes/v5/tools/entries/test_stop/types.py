"""Entry types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateTestStopResponse(BaseModel):
    id: UUID


class GetTestStopResponse(BaseModel):
    id: UUID
    created_at: datetime
    generated: bool
    mcp: bool
    active: bool
    invocation_id: UUID
    stopped: bool
    call_id: UUID
