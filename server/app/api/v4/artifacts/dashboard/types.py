"""Types for dashboard artifact."""

from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.views.analytics.attempts.types import AttemptFactsItem


class DashboardRequest(BaseModel):
    """Request for getting dashboard data."""

    cohort_id: UUID | None = Field(default=None)
    simulation_id: UUID | None = Field(default=None)
    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class DashboardViews(BaseModel):
    """Dashboard view data."""

    attempt_facts: list[AttemptFactsItem] = Field(default_factory=list)


class DashboardResources(BaseModel):
    """Dashboard resource metadata."""

    simulations: dict[str, dict] = Field(default_factory=dict)
    cohorts: dict[str, dict] = Field(default_factory=dict)
    profiles: dict[str, dict] = Field(default_factory=dict)


class DashboardResponse(BaseModel):
    """Response with dashboard data."""

    views: DashboardViews = Field(default_factory=DashboardViews)
    resources: DashboardResources = Field(default_factory=DashboardResources)
    total_count: int = Field(default=0)
