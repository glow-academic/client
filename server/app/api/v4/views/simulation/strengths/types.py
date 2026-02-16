"""Types for simulation strengths view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class StrengthViewItem(BaseModel):
    """A single strength view item."""

    strength_id: UUID
    message_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    created_at: datetime | None = None


class GetStrengthsRequest(BaseModel):
    """Request for getting strengths."""

    message_ids: list[UUID]


class GetStrengthsResponse(BaseModel):
    """Response for getting strengths."""

    items: list[StrengthViewItem]
