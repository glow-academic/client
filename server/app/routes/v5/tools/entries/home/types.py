"""Home entry types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateHomeResponse(BaseModel):
    id: UUID


class GetHomeResponse(BaseModel):
    id: UUID
    session_id: UUID
    position: int
    start_time: datetime | None
    end_time: datetime | None
    active: bool
    mcp: bool
    generated: bool
