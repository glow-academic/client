"""Types for reports artifact."""

from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.views.analytics.attempts.types import AttemptFactsItem


class ReportsRequest(BaseModel):
    """Request for getting reports data."""

    profile_id: UUID | None = Field(default=None)
    simulation_id: UUID | None = Field(default=None)
    cohort_id: UUID | None = Field(default=None)
    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class ReportsViews(BaseModel):
    """Reports view data."""

    attempt_facts: list[AttemptFactsItem] = Field(default_factory=list)


class ReportsResources(BaseModel):
    """Reports resource metadata."""

    simulations: dict[str, dict] = Field(default_factory=dict)
    profiles: dict[str, dict] = Field(default_factory=dict)
    scenarios: dict[str, dict] = Field(default_factory=dict)


class ReportsResponse(BaseModel):
    """Response with reports data."""

    views: ReportsViews = Field(default_factory=ReportsViews)
    resources: ReportsResources = Field(default_factory=ReportsResources)
    total_count: int = Field(default=0)
