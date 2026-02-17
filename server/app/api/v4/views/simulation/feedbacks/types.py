"""Types for simulation feedbacks view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FeedbackViewItem(BaseModel):
    """A single feedback view item."""

    feedback_id: UUID
    grade_id: UUID | None = None
    standard_id: UUID | None = None
    total: float | None = None
    feedback: str | None = None
    created_at: datetime | None = None


class GetFeedbacksRequest(BaseModel):
    """Request for getting feedbacks."""

    grade_ids: list[UUID]


class GetFeedbacksResponse(BaseModel):
    """Response for getting feedbacks."""

    items: list[FeedbackViewItem]

