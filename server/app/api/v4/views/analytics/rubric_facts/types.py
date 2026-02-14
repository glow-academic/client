"""Types for analytics rubric facts view (mv_rubric_facts)."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class RubricFactsItem(BaseModel):
    """Single (chat, standard_group) row from mv_rubric_facts.

    Contains rubric-section data with resource IDs only.
    Resource metadata (names, colors, etc.) fetched via internal handlers.
    """

    # Composite primary key
    chat_id: UUID
    standard_group_id: UUID

    # Rubric dimension
    rubric_id: UUID | None = None

    # Score
    score_percent: float | None = None

    # Resource IDs for filtering
    simulation_id: UUID | None = None
    profile_id: UUID | None = None
    cohort_id: UUID | None = None

    # Timestamps
    attempt_date: date | None = None

    # Filters
    attempt_type: str | None = None  # 'general' | 'practice'
    is_archived: bool = False


class FilterOption(BaseModel):
    """Filter option for dropdowns."""

    value: str
    label: str
    count: int = 0


class GetRubricFactsRequest(BaseModel):
    """Request for getting rubric facts with filters and pagination."""

    # Filters
    profile_id: UUID | None = Field(default=None, description="Filter by profile ID")
    cohort_ids: list[UUID] | None = Field(
        default=None, description="Filter by cohort IDs"
    )
    simulation_ids: list[UUID] | None = Field(
        default=None, description="Filter by simulation IDs"
    )
    rubric_ids: list[UUID] | None = Field(
        default=None, description="Filter by rubric IDs"
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


class GetRubricFactsResponse(BaseModel):
    """Response with rubric facts and pagination info."""

    items: list[RubricFactsItem] = Field(
        default_factory=list, description="Rubric facts items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")

    # Filter options (for dropdowns)
    rubric_options: list[FilterOption] | None = Field(
        default=None, description="Available rubric filter options"
    )
    simulation_options: list[FilterOption] | None = Field(
        default=None, description="Available simulation filter options"
    )
    standard_group_options: list[FilterOption] | None = Field(
        default=None, description="Available standard group filter options"
    )
