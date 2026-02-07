"""Types for activity artifact."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.views.activity.audits.types import ActivityAuditItem
from app.api.v4.views.activity.daily.types import ActivityDailyItem
from app.api.v4.views.activity.feedbacks.types import ActivityFeedbackItem
from app.api.v4.views.activity.logins.types import ActivityLoginItem
from app.api.v4.views.activity.problems.types import ActivityProblemItem
from app.api.v4.views.activity.session_facts.types import ActivitySessionFactsItem
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
    logins: list[ActivityLoginItem] = Field(default_factory=list)
    audits: list[ActivityAuditItem] = Field(default_factory=list)
    feedbacks: list[ActivityFeedbackItem] = Field(default_factory=list)


class ActivityResources(BaseModel):
    """Activity resource metadata."""

    profiles: dict[str, dict] = Field(default_factory=dict)


class ActivityChartPoint(BaseModel):
    """Single chart data point for activity metrics graph."""

    date: str
    event_id: str
    count: int = 0


class ActivityAvailableEvent(BaseModel):
    """Available event type for the activity chart selector."""

    id: str
    name: str
    total_count: int = 0


class ActivityResponse(BaseModel):
    """Response with activity data."""

    # Header metrics (flat)
    sessions_count: int = 0
    active_profiles_count: int = 0
    logins_count: int = 0
    drafts_count: int = 0
    # Chart data
    chart_data: list[ActivityChartPoint] = Field(default_factory=list)
    available_events: list[ActivityAvailableEvent] = Field(default_factory=list)
    # Problems
    problems: list[ActivityProblemItem] = Field(default_factory=list)
    # Keep views/resources for any other consumers
    views: ActivityViews = Field(default_factory=ActivityViews)
    resources: ActivityResources = Field(default_factory=ActivityResources)
    total_count: int = Field(default=0)
