"""Types for activity feedbacks view (mv_activity_feedbacks)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ActivityFeedbackItem(BaseModel):
    """Single feedback row from mv_activity_feedbacks."""

    feedback_id: UUID
    grade_id: UUID | None = None
    feedback_type: str | None = None
    total: int | None = None
    total_points: int | None = None
    pass_points: int | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    call_id: UUID | None = None
    active: bool = False
    simulation_attempt_id: UUID | None = None
    benchmark_test_id: UUID | None = None
    profile_id: UUID | None = None


class GetActivityFeedbacksRequest(BaseModel):
    """Request for activity feedbacks view."""

    profile_id: UUID | None = Field(default=None)
    feedback_type: str | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    sort_order: str = Field(default="desc")
    page_limit: int = Field(default=50, ge=1, le=200)
    page_offset: int = Field(default=0, ge=0)


class GetActivityFeedbacksResponse(BaseModel):
    """Response for activity feedbacks view."""

    items: list[ActivityFeedbackItem] = Field(default_factory=list)
    total_count: int = 0
