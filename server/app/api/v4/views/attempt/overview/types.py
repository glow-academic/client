"""Types for attempt overview view."""

from uuid import UUID

from pydantic import BaseModel, Field


class OverviewViewItem(BaseModel):
    """Single simulation overview from the view."""

    # Core IDs
    simulation_id: UUID

    # JOINed metadata
    simulation_name: str | None = None
    simulation_description: str | None = None
    time_limit: int | None = None
    department_ids: list[str] | None = None
    persona_color: str | None = None
    persona_icon: str | None = None
    cohort_names: list[str] | None = None
    standard_group_ids: list[UUID] | None = None

    # Practice flag
    practice: bool | None = None

    # Metrics from aggregation
    attempt_count: int = 0
    completed_count: int = 0
    highest_score: int | None = None
    has_passed: bool = False

    # Rubric points (for computing pass_pct in Python)
    rubric_total_points: int | None = None
    rubric_pass_points: int | None = None

    # Instructional mode counts (None for member mode)
    passed_count: int | None = None
    in_progress_count: int | None = None
    not_started_count: int | None = None
    total_members: int | None = None


class StandardGroupItem(BaseModel):
    """Standard group mapping for sidebar/legend."""

    standard_group_id: UUID
    name: str | None = None
    description: str | None = None
    points: int | None = None
    pass_points: int | None = None


class StandardItem(BaseModel):
    """Standard mapping for sidebar/legend."""

    standard_id: UUID
    standard_group_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: int | None = None


class GetOverviewRequest(BaseModel):
    """Request for getting overview data."""

    start_date: str | None = Field(
        default=None, description="Start date for filtering (ISO format)"
    )
    end_date: str | None = Field(
        default=None, description="End date for filtering (ISO format)"
    )
    profile_id: UUID | None = Field(default=None, description="Filter by profile ID")
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


class GetOverviewResponse(BaseModel):
    """Response containing overview data."""

    actor_name: str | None = None
    user_role: str | None = None
    has_data: bool = False
    items: list[OverviewViewItem] = Field(
        default_factory=list, description="Simulation card items"
    )
    standard_groups: list[StandardGroupItem] | None = None
    standards: list[StandardItem] | None = None
