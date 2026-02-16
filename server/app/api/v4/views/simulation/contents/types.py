"""Types for simulation contents view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ContentViewItem(BaseModel):
    """A single content view item."""

    content_id: UUID
    message_id: UUID | None = None
    content: str | None = None
    persona_id: UUID | None = None
    idx: int | None = None
    created_at: datetime | None = None


class GetContentsRequest(BaseModel):
    """Request for getting contents."""

    message_ids: list[UUID]


class GetContentsResponse(BaseModel):
    """Response for getting contents."""

    items: list[ContentViewItem]
