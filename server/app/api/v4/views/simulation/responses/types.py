"""Types for simulation responses view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ResponseViewItem(BaseModel):
    """A single response view item."""

    response_id: UUID
    chat_id: UUID | None = None
    question_id: UUID | None = None
    option_id: UUID | None = None
    created_at: datetime | None = None


class GetResponsesRequest(BaseModel):
    """Request for getting responses."""

    chat_ids: list[UUID]


class GetResponsesResponse(BaseModel):
    """Response for getting responses."""

    items: list[ResponseViewItem]
