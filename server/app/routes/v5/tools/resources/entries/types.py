"""Types for entries resource."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetEntryResponse(BaseModel):
    id: UUID
    entry: str
    created_at: datetime
    active: bool
    mcp: bool
    generated: bool
