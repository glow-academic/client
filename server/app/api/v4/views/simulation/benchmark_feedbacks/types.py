"""Types for simulation benchmark_feedbacks view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class BenchmarkFeedbackViewItem(BaseModel):
    """A single benchmark feedback view item."""

    feedback_id: UUID
    grade_id: UUID | None = None
    total: int | None = None
    feedback: str | None = None
    total_points: int | None = None
    pass_points: int | None = None
    created_at: datetime | None = None


class GetBenchmarkFeedbacksRequest(BaseModel):
    """Request for getting benchmark feedbacks."""

    grade_ids: list[UUID]


class GetBenchmarkFeedbacksResponse(BaseModel):
    """Response for getting benchmark feedbacks."""

    items: list[BenchmarkFeedbackViewItem]
