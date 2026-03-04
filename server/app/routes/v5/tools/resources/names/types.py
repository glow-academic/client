"""Names resource types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetNameResponse(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    active: bool
    mcp: bool
    generated: bool
