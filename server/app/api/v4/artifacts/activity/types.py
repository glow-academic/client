"""Types for activity artifact."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.views.activity.session_facts.types import ActivitySessionFactsItem
from app.api.v4.views.activity.daily.types import ActivityDailyItem
from app.api.v4.views.activity.summary.types import ActivitySummaryItem


class ActivityRequest(BaseModel):
    """Request for getting activity data."""

    profile_id: UUID | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class ActivityViews(BaseModel):
    """Activity view data."""

    session_facts: list[ActivitySessionFactsItem] = Field(default_factory=list)
    daily: list[ActivityDailyItem] = Field(default_factory=list)
    summary: ActivitySummaryItem | None = None


class ActivityResources(BaseModel):
    """Activity resource metadata."""

    profiles: dict[str, dict] = Field(default_factory=dict)


class ActivityResponse(BaseModel):
    """Response with activity data."""

    views: ActivityViews = Field(default_factory=ActivityViews)
    resources: ActivityResources = Field(default_factory=ActivityResources)
    total_count: int = Field(default=0)
