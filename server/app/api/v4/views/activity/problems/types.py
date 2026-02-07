"""Types for activity problems view (mv_activity_problems)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ActivityProblemItem(BaseModel):
    """Single problem row from mv_activity_problems."""

    problem_id: UUID
    type: str | None = None
    message: str | None = None
    resolved: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None
    profile_id: UUID | None = None
    profile_name: str | None = None


class GetActivityProblemsRequest(BaseModel):
    """Request for activity problems view."""

    profile_id: UUID | None = Field(default=None)
    resolved: bool | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    sort_order: str = Field(default="desc")
    page_limit: int = Field(default=50, ge=1, le=200)
    page_offset: int = Field(default=0, ge=0)


class GetActivityProblemsResponse(BaseModel):
    """Response for activity problems view."""

    items: list[ActivityProblemItem] = Field(default_factory=list)
    total_count: int = 0
