"""Types for get_standards."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class StandardItem(BaseModel):
    id: UUID
    name: str
    description: str
    points: int
    standard_group_id: UUID
    created_at: datetime
    active: bool
    generated: bool
    mcp: bool
