"""Types for analytics profile facts view (mv_profile_facts)."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class ProfileFactsItem(BaseModel):
    """Profile-level aggregated metrics from mv_profile_facts.

    The query function filters at chat grain then GROUP BY profile_id
    to produce these 12 metrics + daily trend arrays.
    """

    # Profile key
    profile_id: UUID

    # 12 profile metrics
    total_attempts: int = 0
    avg_score: float | None = None
    highest_score: float | None = None
    completion_pct: float | None = None
    first_attempt_pass_rate: float | None = None
    avg_messages_per_session: float | None = None
    avg_persona_response_sec: float | None = None
    session_efficiency: float | None = None
    total_time_minutes: float | None = None
    improvement_rate: float = 0.0
    perfect_score_count: int = 0
    quickest_pass_minutes: float | None = None

    # Daily trend arrays
    daily_dates: list[date] = Field(default_factory=list)
    daily_avg_scores: list[float | None] = Field(default_factory=list)
    daily_attempt_counts: list[int] = Field(default_factory=list)
    daily_completed_counts: list[int] = Field(default_factory=list)
    daily_time_minutes: list[float | None] = Field(default_factory=list)


class FilterOption(BaseModel):
    """Filter option for dropdowns."""

    value: str
    label: str
    count: int = 0


class GetProfileFactsRequest(BaseModel):
    """Request for getting profile facts with filters and pagination."""

    # Filters
    profile_id: UUID | None = Field(default=None, description="Filter by profile ID")
    cohort_ids: list[UUID] | None = Field(
        default=None, description="Filter by cohort IDs"
    )
    department_ids: list[UUID] | None = Field(
        default=None, description="Filter by department IDs"
    )
    simulation_ids: list[UUID] | None = Field(
        default=None, description="Filter by simulation IDs"
    )
    attempt_type: str | None = Field(
        default=None, description="Filter by attempt type: 'general' | 'practice'"
    )
    is_archived: bool = Field(default=False, description="Include archived attempts")
    date_from: date | None = Field(
        default=None, description="Filter by date range start (inclusive)"
    )
    date_to: date | None = Field(
        default=None, description="Filter by date range end (inclusive)"
    )

    # Sorting
    sort_by: str = Field(
        default="avg_score",
        description="Sort field: 'avg_score' | 'total_attempts' | 'highest_score'",
    )
    sort_order: str = Field(default="desc", description="Sort order: 'asc' | 'desc'")

    # Pagination
    page_limit: int = Field(default=5000, description="Items per page", ge=1, le=10000)
    page_offset: int = Field(default=0, description="Pagination offset", ge=0)


class GetProfileFactsResponse(BaseModel):
    """Response with profile-level aggregated metrics and pagination info."""

    items: list[ProfileFactsItem] = Field(
        default_factory=list, description="Profile facts items (one per profile)"
    )
    total_count: int = Field(
        default=0, description="Total profile count before pagination"
    )

    # Filter options (for dropdowns)
    simulation_options: list[FilterOption] | None = Field(
        default=None, description="Available simulation filter options"
    )
    cohort_options: list[FilterOption] | None = Field(
        default=None, description="Available cohort filter options"
    )
    department_options: list[FilterOption] | None = Field(
        default=None, description="Available department filter options"
    )
