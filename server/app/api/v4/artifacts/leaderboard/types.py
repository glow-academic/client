"""Types for leaderboard artifact."""

from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.views.analytics.attempts.types import AttemptFactsItem


class LeaderboardRequest(BaseModel):
    """Request for getting leaderboard data."""

    simulation_id: UUID | None = Field(default=None)
    cohort_id: UUID | None = Field(default=None)
    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class LeaderboardViews(BaseModel):
    """Leaderboard view data."""

    attempt_facts: list[AttemptFactsItem] = Field(default_factory=list)


class LeaderboardResources(BaseModel):
    """Leaderboard resource metadata."""

    profiles: dict[str, dict] = Field(default_factory=dict)
    simulations: dict[str, dict] = Field(default_factory=dict)


class LeaderboardResponse(BaseModel):
    """Response with leaderboard data."""

    views: LeaderboardViews = Field(default_factory=LeaderboardViews)
    resources: LeaderboardResources = Field(default_factory=LeaderboardResources)
    total_count: int = Field(default=0)
