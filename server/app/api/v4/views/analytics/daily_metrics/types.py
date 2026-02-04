"""Types for analytics daily metrics view (mv_daily_metrics)."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class DailyMetricsItem(BaseModel):
    """Single row from mv_daily_metrics."""

    date_key: date
    cohort_id: UUID | None = None
    simulation_id: UUID
    attempt_type: str
    is_archived: bool = False

    attempt_count: int = 0
    unique_profiles: int = 0
    completed_count: int = 0
    passed_count: int = 0
    avg_score: float | None = None
    total_time_seconds: int = 0
    avg_messages: float | None = None


class GetDailyMetricsRequest(BaseModel):
    """Request for filtering mv_daily_metrics."""

    cohort_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    attempt_type: str | None = None
    is_archived: bool = False
    date_from: date | None = None
    date_to: date | None = None

    sort_by: str = Field(default="date", description="'date' | 'avg_score'")
    sort_order: str = Field(default="asc", description="'asc' | 'desc'")

    page_limit: int = Field(default=365, ge=1, le=2000)
    page_offset: int = Field(default=0, ge=0)


class GetDailyMetricsResponse(BaseModel):
    """Response for daily metrics query."""

    items: list[DailyMetricsItem] = Field(default_factory=list)
    total_count: int = 0
