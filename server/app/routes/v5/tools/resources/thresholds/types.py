"""Types for thresholds resource."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetThresholdResponse(BaseModel):
    id: UUID
    value: int
    created_at: datetime
    active: bool
    mcp: bool
    generated: bool
