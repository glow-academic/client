"""Custom types for NEW home endpoints.

These types define the client-facing API contract, separate from the
auto-generated SQL parameter types. The key difference is that internal
parameters (mode, accessible_cohort_ids) are NOT included here - they
are injected by Python from the context query.
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# =============================================================================
# Overview endpoint types (client-facing)
# =============================================================================


class SimulationCard(BaseModel):
    """Simulation card for home overview.

    This is the client-facing type returned by the API.
    Python computes fields like status, pass_pct, cohort_names from raw SQL data.
    """

    view_mode: str | None = None  # 'member' | 'instructional'
    simulation_id: UUID | None = None
    simulation_title: str | None = None
    simulation_description: str | None = None
    simulation_name: str | None = None
    time_limit: int | None = None
    num_sessions: int | None = None  # attempt_count
    highest_score: int | None = None
    standard_groups: list[str] | None = None  # standard_group_ids as strings
    color: str | None = None  # from persona
    icon: str | None = None  # from persona
    has_passed: bool | None = None
    pass_rate: int | None = None  # computed from rubric points
    status: str | None = None  # 'passed' | 'in-progress' | 'not-started'
    completion_pct: int | None = None  # for instructional mode
    passed_count: int | None = None  # for instructional mode
    in_progress_count: int | None = None  # for instructional mode
    not_started_count: int | None = None  # for instructional mode
    pass_pct: int | None = None  # computed from rubric points
    cohort_name: str | None = None  # first cohort name
    cohort_names_junction: str | None = None  # formatted "A, B, and C"


class StandardGroupMapping(BaseModel):
    """Standard group metadata for mapping."""

    standard_group_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: int | None = None
    pass_points: int | None = None


class StandardMapping(BaseModel):
    """Standard metadata for mapping."""

    standard_id: UUID | None = None
    standard_group_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: int | None = None


class SimulationMapping(BaseModel):
    """Simulation metadata for mapping."""

    simulation_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    time_limit: int | None = None
    department_ids: list[str] | None = None


class GetHomeOverviewNewResponse(BaseModel):
    """Client-facing API response for home overview.

    Contains transformed simulation cards (items) ready for frontend consumption.
    """

    actor_name: str | None = None
    mode: str | None = None  # 'member' | 'instructional'
    has_data: bool | None = None
    items: list[SimulationCard] | None = None
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None
    simulations: list[SimulationMapping] | None = None


# =============================================================================
# History endpoint types (client-facing)
# =============================================================================


class GetHomeHistoryNewClientRequest(BaseModel):
    """Client API request for home history.

    Note: mode and accessible_cohort_ids are NOT included here - they are
    internal parameters injected by the Python backend from the context query.
    """

    start_date: str
    end_date: str
    cohort_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    department_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    roles: Any | None = None
    simulation_filters: list[str] | None = Field(default_factory=list)  # type: ignore[arg-type]
    search: str | None = None
    profile_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    simulation_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    scenario_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    infinite_mode: bool | None = None
    sort_by: str | None = None
    sort_order: str | None = None
    page: int | None = 0
    page_size: int | None = 20


class HistoryAttempt(BaseModel):
    """Attempt record for home history.

    This is the client-facing type returned by the API.
    Python computes fields like score_status, show_view, show_continue.
    """

    attempt_id: UUID | None = None
    date: str | None = None  # ISO timestamp
    profile_id: UUID | None = None
    profile_name: str | None = None
    simulation_name: str | None = None
    num_scenarios: int | None = None
    num_scenarios_completed: int | None = None
    infinite_mode: bool | None = None
    time_limit: int | None = None
    persona_names_junction: list[str] | None = None
    persona_colors_junction: list[str] | None = None
    score: int | None = None
    score_status: str | None = None  # 'high' | 'medium' | 'low' | None
    simulation_id: UUID | None = None
    scenario_ids: list[UUID] | None = None
    scenario_titles: list[str] | None = None
    is_archived: bool | None = None  # Always False for home (MV filters out archived)
    show_view: bool | None = None
    show_continue: bool | None = None
    practice_simulation: bool | None = None  # Always False for home
    pass_pct: int | None = None
    department_ids: list[str] | None = None
    cohort_names_junction: list[str] | None = None
    practice_scenario_id: UUID | None = None


class FilterOption(BaseModel):
    """Filter option for history dropdowns."""

    value: str | None = None
    label: str | None = None
    count: int | None = None


class GetHomeHistoryNewResponse(BaseModel):
    """Client-facing API response for home history.

    Contains transformed attempts and filter options.
    """

    actor_name: str | None = None
    data: list[HistoryAttempt] | None = None
    total_count: int | None = None
    page: int | None = None
    page_size: int | None = None
    total_pages: int | None = None
    profile_options: list[FilterOption] | None = None
    simulation_options: list[FilterOption] | None = None
    scenario_options_junction: list[FilterOption] | None = None
