"""Types for get_images."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ImageItem(BaseModel):
    id: UUID
    name: str
    description: str
    created_at: datetime
    active: bool
    generated: bool
    mcp: bool
