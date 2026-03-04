"""Types for uploads resource."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class GetUploadResponse(BaseModel):
    id: UUID
    created_at: datetime
    active: bool
    mcp: bool
    generated: bool
