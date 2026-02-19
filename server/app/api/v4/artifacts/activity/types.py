"""Types for activity artifact."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.entries.activity.get import ActivityViewItem
from app.api.v4.entries.audits.get import AuditViewItem
from app.api.v4.entries.grants.get import GrantViewItem
from app.api.v4.entries.logins.get import LoginViewItem
from app.api.v4.entries.problems.get import ProblemViewItem
from app.api.v4.entries.sessions.get import SessionViewItem


class ActivityRequest(BaseModel):
    """Request for getting activity data."""

    profile_id: UUID | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    department_ids: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class ActivityViews(BaseModel):
    """Activity view data."""

    sessions: list[SessionViewItem] = Field(default_factory=list)
    activity: list[ActivityViewItem] = Field(default_factory=list)
    logins: list[LoginViewItem] = Field(default_factory=list)
    audits: list[AuditViewItem] = Field(default_factory=list)
    problems: list[ProblemViewItem] = Field(default_factory=list)
    grants: list[GrantViewItem] = Field(default_factory=list)


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
    emulations_count: int = 0
    # Chart data
    chart_data: list[ActivityChartPoint] = Field(default_factory=list)
    available_events: list[ActivityAvailableEvent] = Field(default_factory=list)
    # Problems
    problems: list[ProblemViewItem] = Field(default_factory=list)
    # Keep views/resources for any other consumers
    views: ActivityViews = Field(default_factory=ActivityViews)
    resources: ActivityResources = Field(default_factory=ActivityResources)
    total_count: int = Field(default=0)
