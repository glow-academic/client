"""Types for simulation hints view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class HintViewItem(BaseModel):
    """A single hint view item."""

    hint_id: UUID
    message_id: UUID | None = None
    hint: str | None = None
    idx: int | None = None
    created_at: datetime | None = None


class GetHintsRequest(BaseModel):
    """Request for getting hints."""

    message_ids: list[UUID]


class GetHintsResponse(BaseModel):
    """Response for getting hints."""

    items: list[HintViewItem]

