"""Types for get_standard_groups."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class StandardGroupItem(BaseModel):
    id: UUID
    name: str
    short_name: str
    description: str
    points: int
    pass_points: int
    created_at: datetime
    active: bool
    generated: bool
    mcp: bool
