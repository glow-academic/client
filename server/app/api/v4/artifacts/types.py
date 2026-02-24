"""Shared types for artifact endpoints."""

from uuid import UUID

from pydantic import BaseModel, Field

from app.sql.types import (
    QGetAgentsV4Item,
    QGetArgsOutputsV4Item,
    QGetArgsV4Item,
    QGetModelsV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
)


class WebsocketArtifacts(BaseModel):
    """Shared artifacts chain for websocket generation context.

    Houses the settings-derived resources needed by the generate pipeline.
    Identical across all artifacts — defined once here.
    """

    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None
    args: list[QGetArgsV4Item] | None = None
    args_outputs: list[QGetArgsOutputsV4Item] | None = None
    profile: list[QGetProfilesV4Item] | None = None
    params: BaseModel | None = None


# Backwards compatibility alias
WebsocketConfig = WebsocketArtifacts


class FilterOption(BaseModel):
    """A single filter option for dropdown selectors."""

    value: str
    label: str | None = None
    count: int | None = None


class HistoryItem(BaseModel):
    """Single attempt row in history list."""

    attempt_id: UUID
    date: str | None = None
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
    score: int | None = None
    score_status: str | None = None
    pass_pct: int | None = None
    show_view: bool | None = None
    show_continue: bool | None = None
    is_archived: bool | None = None
    practice_simulation: bool | None = None
    practice_scenario_id: UUID | None = None


class HistoryResponse(BaseModel):
    """Paginated attempt history list."""

    data: list[HistoryItem] = Field(default_factory=list)
    total_count: int = 0
    page: int = 0
    page_size: int = 20
    total_pages: int = 0
    simulation_options: list[FilterOption] | None = None
    scenario_options: list[FilterOption] | None = None
    profile_options: list[FilterOption] | None = None


class TestHistoryItem(BaseModel):
    """Single test row in history list."""

    attempt_id: str
    eval_id: str | None = None
    eval_name: str | None = None
    eval_description: str | None = None
    rubric_id: str | None = None
    rubric_name: str | None = None
    created_at: str | None = None
    archived: bool = False
    status: str = "pending"
    total_runs: int = 0
    completed_runs: int = 0
    pending_runs: int = 0


class TestHistoryResponse(BaseModel):
    """Paginated test history list."""

    data: list[TestHistoryItem] = Field(default_factory=list)
    total_count: int = 0
    page: int = 0
    page_size: int = 10
    eval_options: list[FilterOption] | None = None


class AnalyticsFilterOptions(BaseModel):
    """Filter options returned by analytics endpoints for populating UI dropdowns."""

    earliest_date: str | None = None
    simulation_options: list[FilterOption] = Field(default_factory=list)
    scenario_options: list[FilterOption] = Field(default_factory=list)
    profile_options: list[FilterOption] = Field(default_factory=list)


class BaseAnalyticsRequest(BaseModel):
    """Common request fields shared across analytics endpoints."""

    start_date: str | None = None
    end_date: str | None = None
    cohort_ids: list[str] = Field(default_factory=list)
    department_ids: list[str] = Field(default_factory=list)
    simulation_ids: list[str] = Field(default_factory=list)
    roles: list[str] = Field(default_factory=list)
    simulation_filters: list[str] = Field(default_factory=list)
    actor_profile_id: str | None = None
    target_profile_id: str | None = None
