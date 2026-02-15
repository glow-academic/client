"""Types for analytics simulation facts view (mv_simulation_facts)."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class SimulationFactsItem(BaseModel):
    """Single chat row from mv_simulation_facts.

    Contains all simulation/secondary-section data with resource IDs only.
    Resource metadata (names, colors, etc.) fetched via internal handlers.
    """

    # Primary key
    chat_id: UUID

    # Resource IDs (metadata fetched via internal handlers)
    attempt_id: UUID | None = None
    profile_id: UUID | None = None
    cohort_id: UUID | None = None
    department_id: UUID | None = None
    simulation_id: UUID | None = None
    persona_id: UUID | None = None

    # Timestamps
    attempt_date: date | None = None

    # Pre-computed
    attempt_number: int = 0

    # Measures
    grade_percent: float | None = None
    passed: bool | None = None
    completed: bool = False
    time_taken_seconds: int | None = None

    # Filters
    attempt_type: str | None = None  # 'general' | 'practice'
    is_archived: bool = False


class FilterOption(BaseModel):
    """Filter option for dropdowns."""

    value: str
    label: str
    count: int = 0


class GetSimulationFactsRequest(BaseModel):
    """Request for getting simulation facts with filters and pagination."""

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
    page_limit: int = Field(default=5000, description="Items per page", ge=1, le=10000)
    page_offset: int = Field(default=0, description="Pagination offset", ge=0)


class GetSimulationFactsResponse(BaseModel):
    """Response with simulation facts and pagination info."""

    items: list[SimulationFactsItem] = Field(
        default_factory=list, description="Simulation facts items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")

    # Filter options (for dropdowns)
    cohort_options: list[FilterOption] | None = Field(
        default=None, description="Available cohort filter options"
    )
    department_options: list[FilterOption] | None = Field(
        default=None, description="Available department filter options"
    )
    simulation_options: list[FilterOption] | None = Field(
        default=None, description="Available simulation filter options"
    )
    persona_options: list[FilterOption] | None = Field(
        default=None, description="Available persona filter options"
    )
