"""Types for analytics profile facts view (mv_profile_facts)."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class ProfileFactsItem(BaseModel):
    """Single chat row from mv_profile_facts.

    Contains chat-grain data with resource IDs and measures.
    All aggregation (profile metrics, daily trends, etc.) is done in Python.
    """

    # Primary key
    chat_id: UUID

    # Resource IDs
    attempt_id: UUID
    profile_id: UUID
    cohort_id: UUID | None = None
    department_id: UUID | None = None
    simulation_id: UUID
    scenario_id: UUID | None = None

    # Timestamps
    attempt_date: date | None = None

    # Measures
    grade_percent: float | None = None
    passed: bool | None = None
    completed: bool = False
    time_taken_seconds: int | None = None
    num_messages_total: int = 0
    avg_response_sec: float | None = None

    # Filters
    attempt_type: str | None = None  # 'general' | 'practice'
    is_archived: bool = False
    infinite_mode: bool = False


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
    sort_by: str = Field(default="date", description="Sort field: 'date'")
    sort_order: str = Field(default="desc", description="Sort order: 'asc' | 'desc'")

    # Pagination
    page_limit: int = Field(default=10000, description="Items per page", ge=1, le=50000)
    page_offset: int = Field(default=0, description="Pagination offset", ge=0)


class GetProfileFactsResponse(BaseModel):
    """Response with chat-grain profile facts and pagination info."""

    items: list[ProfileFactsItem] = Field(
        default_factory=list, description="Profile facts items (one per chat)"
    )
    total_count: int = Field(default=0, description="Total count before pagination")

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
