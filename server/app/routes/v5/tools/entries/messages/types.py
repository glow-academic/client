"""Messages entry types — handcrafted, co-located with handler."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CreateMessageResponse(BaseModel):
    id: UUID
    created_at: datetime
