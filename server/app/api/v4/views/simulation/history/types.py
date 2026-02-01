"""Types for simulation history view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class HistoryViewItem(BaseModel):
    """Single attempt from the history view."""

    # Primary key
    attempt_id: UUID

    # Keys for filtering
    profile_id: UUID | None = None
    simulation_id: UUID | None = None
    cohort_id: UUID | None = None
    department_id: UUID | None = None

    # Resource metadata (JOINed)
    simulation_name: str | None = None
    profile_name: str | None = None
    cohort_name: str | None = None
    department_name: str | None = None
    persona_color: str | None = None
    persona_icon: str | None = None
    time_limit: int | None = None

    # Timestamps
    attempt_created_at: datetime | None = None

    # Flags
    practice: bool = False
    infinite_mode: bool = False
    is_archived: bool = False

    # Metrics
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

    # Arrays for display
    scenario_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    scenario_names: list[str] | None = None
    persona_names: list[str] | None = None
    persona_colors: list[str] | None = None
    department_ids: list[UUID] | None = None


class FilterOption(BaseModel):
    """Filter option for dropdowns."""

    value: str
    label: str | None = None
    count: int = 0


class GetHistoryRequest(BaseModel):
    """Request for getting history data."""

    profile_id: UUID | None = Field(
        default=None, description="Filter by profile ID"
    )
    simulation_ids: list[UUID] | None = Field(
        default=None, description="Filter by simulation IDs"
    )
    cohort_ids: list[UUID] | None = Field(
        default=None, description="Filter by cohort IDs"
    )
    department_ids: list[UUID] | None = Field(
        default=None, description="Filter by department IDs"
    )
    practice: bool | None = Field(
        default=None,
        description="Filter by practice mode. None=all, True=practice, False=home",
    )
    date_from: datetime | None = Field(
        default=None, description="Filter by date range start"
    )
    date_to: datetime | None = Field(
        default=None, description="Filter by date range end"
    )
    scenario_ids: list[UUID] | None = Field(
        default=None, description="Filter by scenario IDs"
    )
    infinite_mode: bool | None = Field(
        default=None, description="Filter by infinite mode"
    )
    search: str | None = Field(
        default=None, description="Search by simulation name"
    )
    sort_by: str | None = Field(
        default="date", description="Sort field: date, score, simulation_name"
    )
    sort_order: str | None = Field(
        default="desc", description="Sort order: asc, desc"
    )
    page_limit: int = Field(default=50, ge=1, le=100, description="Items per page")
    page_offset: int = Field(default=0, ge=0, description="Pagination offset")
    profile_ids: list[UUID] | None = Field(
        default=None, description="Filter by multiple profile IDs (for multi-user view)"
    )
    show_archived: bool = Field(
        default=False, description="Include archived attempts"
    )


class GetHistoryResponse(BaseModel):
    """Response containing history data."""

    actor_name: str | None = None
    total_count: int = Field(default=0, description="Total count for pagination")
    items: list[HistoryViewItem] = Field(
        default_factory=list, description="History data items"
    )
    simulation_options: list[FilterOption] | None = None
    scenario_options: list[FilterOption] | None = None
    profile_options: list[FilterOption] | None = None
