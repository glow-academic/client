"""Types for analytics scenario facts view (mv_scenario_facts)."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field


class ScenarioFactsItem(BaseModel):
    """Single chat row from mv_scenario_facts.

    Contains scenario/footer data with resource IDs only.
    Parameter resolution done at runtime via hydrated scenario/persona/document
    resources (denormalized parameter_field_ids[]) and parameter_fields_resource.
    """

    # Primary key
    chat_id: UUID

    # Resource IDs
    attempt_id: UUID
    simulation_id: UUID
    scenario_id: UUID | None = None
    persona_id: UUID | None = None
    document_ids: list[UUID] = Field(default_factory=list)
    profile_id: UUID | None = None
    cohort_id: UUID | None = None
    department_id: UUID | None = None

    # Measures
    grade_percent: float | None = None
    passed: bool | None = None
    completed: bool = False

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


class GetScenarioFactsRequest(BaseModel):
    """Request for getting scenario facts with filters and pagination."""

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
    scenario_ids: list[UUID] | None = Field(
        default=None, description="Filter by scenario IDs"
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


class GetScenarioFactsResponse(BaseModel):
    """Response with scenario facts and pagination info."""

    items: list[ScenarioFactsItem] = Field(
        default_factory=list, description="Scenario facts items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")

    # Filter options (for dropdowns)
    department_options: list[FilterOption] | None = Field(
        default=None, description="Available department filter options"
    )
    simulation_options: list[FilterOption] | None = Field(
        default=None, description="Available simulation filter options"
    )
    scenario_options: list[FilterOption] | None = Field(
        default=None, description="Available scenario filter options"
    )
