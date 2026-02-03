"""Types for analytics attempts view (mv_attempt_facts)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AttemptFactsItem(BaseModel):
    """Single attempt from mv_attempt_facts.

    Contains all attempt-level data with resource IDs only.
    Resource metadata (names, colors, etc.) fetched via internal handlers.
    """

    # Primary key
    attempt_id: UUID

    # Resource IDs (metadata fetched via internal handlers)
    profile_id: UUID | None = None
    simulation_id: UUID | None = None
    cohort_id: UUID | None = None
    department_id: UUID | None = None

    # Timestamps
    attempt_created_at: datetime | None = None

    # Flags
    attempt_type: str | None = None  # 'general' | 'practice'
    is_archived: bool = False
    infinite_mode: bool = False

    # Metrics (aggregated from chats)
    num_chats: int = 0
    num_chats_completed: int = 0
    num_scenarios: int = 0
    num_scenarios_completed: int = 0
    score_percent: float | None = None
    has_passed: bool = False
    total_time_seconds: int = 0

    # Rubric points
    rubric_total_points: int | None = None
    rubric_pass_points: int | None = None

    # Arrays for display/filtering (IDs only, metadata via handlers)
    scenario_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None


class FilterOption(BaseModel):
    """Filter option for dropdowns."""

    value: str
    label: str
    count: int = 0


class GetAttemptFactsRequest(BaseModel):
    """Request for getting attempt facts with filters and pagination."""

    # Filters
    profile_id: UUID | None = Field(default=None, description="Filter by profile ID")
    attempt_type: str | None = Field(
        default=None, description="Filter by attempt type: 'general' | 'practice'"
    )
    is_archived: bool = Field(default=False, description="Include archived attempts")
    simulation_ids: list[UUID] | None = Field(
        default=None, description="Filter by simulation IDs"
    )
    cohort_ids: list[UUID] | None = Field(
        default=None, description="Filter by cohort IDs"
    )
    department_ids: list[UUID] | None = Field(
        default=None, description="Filter by department IDs"
    )
    scenario_ids: list[UUID] | None = Field(
        default=None, description="Filter by scenario IDs (matches if any overlap)"
    )
    infinite_mode: bool | None = Field(
        default=None, description="Filter by infinite mode"
    )
    date_from: datetime | None = Field(
        default=None, description="Filter by date range start (inclusive)"
    )
    date_to: datetime | None = Field(
        default=None, description="Filter by date range end (exclusive)"
    )
    search: str | None = Field(
        default=None, description="Search term (searches simulation_id for now)"
    )

    # Sorting
    sort_by: str = Field(default="date", description="Sort field: 'date' | 'score'")
    sort_order: str = Field(default="desc", description="Sort order: 'asc' | 'desc'")

    # Pagination
    page_limit: int = Field(default=50, description="Items per page", ge=1, le=100)
    page_offset: int = Field(default=0, description="Pagination offset", ge=0)


class GetAttemptFactsResponse(BaseModel):
    """Response with attempt facts and pagination info."""

    items: list[AttemptFactsItem] = Field(
        default_factory=list, description="Attempt facts items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")

    # Filter options (for dropdowns)
    simulation_options: list[FilterOption] | None = Field(
        default=None, description="Available simulation filter options"
    )
    scenario_options: list[FilterOption] | None = Field(
        default=None, description="Available scenario filter options"
    )
    profile_options: list[FilterOption] | None = Field(
        default=None, description="Available profile filter options"
    )
