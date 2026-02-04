"""Types for analytics profile metrics view (mv_profile_metrics)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ProfileMetricsItem(BaseModel):
    """Single row from mv_profile_metrics."""

    profile_id: UUID
    attempt_type: str
    is_archived: bool = False

    total_attempts: int = 0
    avg_score: float | None = None
    highest_score: float | None = None
    completion_pct: float | None = None
    first_attempt_pass_rate: float | None = None
    avg_messages_per_session: float | None = None
    avg_persona_response_sec: float | None = None
    session_efficiency: float | None = None
    total_time_minutes: float | None = None
    improvement_rate: float | None = None
    perfect_score_count: int = 0
    quickest_pass_minutes: float | None = None
    first_attempt_at: datetime | None = None
    last_attempt_at: datetime | None = None
    simulation_ids: list[UUID] = Field(default_factory=list)
    scenario_ids: list[UUID] = Field(default_factory=list)
    cohort_ids: list[UUID] = Field(default_factory=list)


class GetProfileMetricsRequest(BaseModel):
    """Request for filtering mv_profile_metrics."""

    profile_id: UUID | None = None
    profile_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None

    attempt_type: str | None = None
    is_archived: bool = False
    min_attempts: int | None = None

    sort_by: str = Field(
        default="avg_score",
        description="'avg_score' | 'highest_score' | 'total_attempts' | 'improvement' | 'last_attempt_at'",
    )
    sort_order: str = Field(default="desc", description="'asc' | 'desc'")

    page_limit: int = Field(default=50, ge=1, le=200)
    page_offset: int = Field(default=0, ge=0)


class GetProfileMetricsResponse(BaseModel):
    """Response for profile metrics query."""

    items: list[ProfileMetricsItem] = Field(default_factory=list)
    total_count: int = 0
