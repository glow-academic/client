"""Types for activity artifact."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.infra.auth.types import AnalyticsFacets
from app.infra.session.types import SessionListItem


class ActivityRequest(BaseModel):
    """Request for getting activity data (top cards)."""

    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    department_ids: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)


class ListActivityRequest(BaseModel):
    """Request for activity list endpoint (session history, paginated)."""

    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    department_ids: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)

    active: bool | None = Field(default=None)
    page: int = 0
    page_size: int = 50
    sort_order: str = "desc"


class ProfileSummaryItem(BaseModel):
    """Per-profile aggregate stats for the summary card."""

    profile_id: UUID | None = None
    profile_name: str | None = None
    sessions_count: int = 0
    logins_count: int = 0
    grants_count: int = 0
    problems_count: int = 0
    activity_count: int = 0


class ActivityResources(BaseModel):
    """Activity resource metadata."""

    profiles: dict[str, dict] = Field(default_factory=dict)


class ActivityResponse(BaseModel):
    """Response with activity data (top cards)."""

    # Header metrics (flat)
    sessions_count: int = 0
    active_profiles_count: int = 0
    logins_count: int = 0
    emulations_count: int = 0
    # Profile summary
    profile_summary: list[ProfileSummaryItem] = Field(default_factory=list)
    # Resources
    resources: ActivityResources = Field(default_factory=ActivityResources)
    # Inline analytics facets
    analytics: AnalyticsFacets | None = None


class ListActivityResponse(BaseModel):
    """Response for activity list (session history, paginated)."""

    data: list[SessionListItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
    page: int = 0
    page_size: int = 50
    total_pages: int = 0


# =============================================================================
# Export Types
# =============================================================================


class ExportActivityApiResponse(BaseModel):
    """Response model for activity export."""

    content: str
    file_name: str
    mime_type: str
    row_count: int
