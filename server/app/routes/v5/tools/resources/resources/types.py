"""Types for resources resource."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetResourceResponse(BaseModel):
    id: UUID
    resource: str
    created_at: datetime
    active: bool
    mcp: bool
    generated: bool
