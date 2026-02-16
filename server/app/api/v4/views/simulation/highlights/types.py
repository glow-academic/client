"""Types for simulation highlights view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class HighlightViewItem(BaseModel):
    """A single highlight view item."""

    highlight_id: UUID
    strength_id: UUID | None = None
    section: str | None = None
    idx: int | None = None
    created_at: datetime | None = None


class GetHighlightsRequest(BaseModel):
    """Request for getting highlights."""

    strength_ids: list[UUID]


class GetHighlightsResponse(BaseModel):
    """Response for getting highlights."""

    items: list[HighlightViewItem]
