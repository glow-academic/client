"""Custom types for NEW home endpoints.

These types define the client-facing API contract, separate from the
auto-generated SQL parameter types. The key difference is that internal
parameters (mode, accessible_cohort_ids) are NOT included here - they
are injected by Python from the context query.
"""

from uuid import UUID

from pydantic import BaseModel, Field


# =============================================================================
# Overview endpoint types (client-facing)
# =============================================================================


class SimulationCard(BaseModel):
    """Simulation card for home overview.

    SQL JOINs all metadata. Python computes: status, pass_pct, cohort_names_junction.
    """

    view_mode: str  # 'member' | 'instructional'
    simulation_id: UUID
    simulation_name: str | None = None
    simulation_description: str | None = None
    time_limit: int | None = None
    num_sessions: int | None = None  # attempt_count
    highest_score: int | None = None
    standard_groups: list[str] | None = None  # standard_group_ids as strings
    color: str | None = None  # from persona
    icon: str | None = None  # from persona
    has_passed: bool | None = None
    # Computed by Python (business logic)
    status: str | None = None  # 'passed' | 'in-progress' | 'not-started'
    pass_pct: int | None = None  # computed from rubric points
    # Instructional mode only
    completion_pct: int | None = None
    passed_count: int | None = None
    in_progress_count: int | None = None
    not_started_count: int | None = None
    # Cohort info
    cohort_names_junction: str | None = None  # formatted "A, B, and C"


class StandardGroupMapping(BaseModel):
    """Standard group metadata for sidebar/legend."""

    standard_group_id: UUID
    name: str | None = None
    description: str | None = None
    points: int | None = None
    pass_points: int | None = None


class StandardMapping(BaseModel):
    """Standard metadata for sidebar/legend."""

    standard_id: UUID
    standard_group_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: int | None = None


class GetHomeOverviewNewResponse(BaseModel):
    """Client-facing API response for home overview."""

    actor_name: str | None = None
    mode: str | None = None  # 'member' | 'instructional'
    has_data: bool | None = None
    items: list[SimulationCard] | None = None
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None


# =============================================================================
# History endpoint types (client-facing)
# =============================================================================


class GetHomeHistoryNewClientRequest(BaseModel):
    """Client API request for home history.

    Note: Home history is single-user (profile from auth header).
    Filters like roles, simulation_filters, profile_ids are not applicable.
    """

    start_date: str
    end_date: str
    cohort_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    department_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    simulation_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    scenario_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    infinite_mode: bool | None = None
    search: str | None = None
    sort_by: str | None = None  # 'date' | 'score' | 'simulation_name'
    sort_order: str | None = None  # 'asc' | 'desc'
    page: int | None = 0
    page_size: int | None = 20


class HistoryAttempt(BaseModel):
    """Attempt record for home history.

    SQL JOINs all metadata. Python computes: score_status, show_view, show_continue, pass_pct.
    """

    attempt_id: UUID
    date: str | None = None  # ISO timestamp
    profile_id: UUID | None = None
    profile_name: str | None = None
    simulation_id: UUID | None = None
    simulation_name: str | None = None
    num_scenarios: int | None = None
    num_scenarios_completed: int | None = None
    infinite_mode: bool | None = None
    time_limit: int | None = None
    persona_names_junction: list[str] | None = None
    persona_colors_junction: list[str] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_titles: list[str] | None = None
    department_ids: list[str] | None = None
    cohort_names_junction: list[str] | None = None
    # Computed by Python (business logic)
    score: int | None = None
    score_status: str | None = None  # 'high' | 'medium' | 'low'
    pass_pct: int | None = None
    show_view: bool | None = None
    show_continue: bool | None = None


class FilterOption(BaseModel):
    """Filter option for history dropdowns."""

    value: str
    label: str | None = None
    count: int | None = None


class GetHomeHistoryNewResponse(BaseModel):
    """Client-facing API response for home history."""

    actor_name: str | None = None
    data: list[HistoryAttempt] | None = None
    total_count: int | None = None
    page: int | None = None
    page_size: int | None = None
    total_pages: int | None = None
    simulation_options: list[FilterOption] | None = None
    scenario_options: list[FilterOption] | None = None
