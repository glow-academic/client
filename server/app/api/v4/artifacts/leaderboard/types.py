"""Types for leaderboard artifact get bundle."""

from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.artifacts.types import FilterOption
from app.api.v4.views.analytics.attempts.types import AttemptFactsItem
from app.api.v4.views.analytics.chat_facts.types import ChatFactsItem
from app.api.v4.views.analytics.daily_metrics.types import DailyMetricsItem
from app.api.v4.views.analytics.profile_metrics.types import ProfileMetricsItem


class LeaderboardRequest(BaseModel):
    """Request for getting leaderboard artifact bundle."""

    start_date: str | None = None
    end_date: str | None = None
    cohort_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    roles: list[str] | None = None
    simulation_filters: list[str] | None = None
    actor_profile_id: UUID | None = None
    target_profile_id: UUID | None = None

    # Backward-compatible singular filters.
    cohort_id: UUID | None = None
    simulation_id: UUID | None = None

    profile_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    search: str | None = None
    sort_by: str = Field(default="highest_score")
    sort_order: str = Field(default="desc")

    page_limit: int = Field(default=50, ge=1, le=200)
    page_offset: int = Field(default=0, ge=0)
    accessible_cohort_ids: list[str] = Field(default_factory=list)
    accessible_department_ids: list[str] = Field(default_factory=list)


class LeaderboardMetric(BaseModel):
    """Metric envelope expected by leaderboard UI."""

    has_data: bool | None = None
    method: str | None = None
    current_value: float | int | None = None
    key_field: str | None = None
    trend_data: list[str] | None = None
    data_points: list[str] | None = None
    hover: str | None = None


class LeaderboardMetricsEntry(BaseModel):
    """Row metrics for leaderboard cards and table."""

    total_attempts: LeaderboardMetric | None = None
    highest_score_avg: LeaderboardMetric | None = None
    messages_per_session: LeaderboardMetric | None = None
    persona_response_seconds: LeaderboardMetric | None = None
    time_spent_minutes: LeaderboardMetric | None = None
    improvement_rate_per_day: LeaderboardMetric | None = None
    perfect_score_count: LeaderboardMetric | None = None
    quickest_pass_minutes: LeaderboardMetric | None = None


class LeaderboardDataRow(BaseModel):
    """Normalized leaderboard row consumed by UI."""

    rank: int | None = None
    profile_id: str | None = None
    name: str | None = None
    simulation_ids: list[str] | None = None
    scenario_ids: list[str] | None = None
    metrics_entry: LeaderboardMetricsEntry | None = None


class LeaderboardSectionStatus(BaseModel):
    """Section-level status metadata."""

    has_data: bool = False
    status: str = "neutral"
    note: str | None = None


class LeaderboardHeaderMetrics(BaseModel):
    """Top-level leaderboard summary metrics."""

    total_profiles: LeaderboardMetric = Field(default_factory=LeaderboardMetric)
    total_attempts: LeaderboardMetric = Field(default_factory=LeaderboardMetric)
    average_score: LeaderboardMetric = Field(default_factory=LeaderboardMetric)
    perfect_scores: LeaderboardMetric = Field(default_factory=LeaderboardMetric)


class LeaderboardAccoladeWinner(BaseModel):
    """Winner summary for a leaderboard accolade."""

    profile_id: str | None = None
    name: str | None = None
    value: float | int | None = None
    details: str | None = None


class LeaderboardAccoladeWinners(BaseModel):
    """Deterministic accolade winners computed server-side."""

    highest_scorer: LeaderboardAccoladeWinner | None = None
    perfect_score: LeaderboardAccoladeWinner | None = None
    longest_convo: LeaderboardAccoladeWinner | None = None
    response_times: LeaderboardAccoladeWinner | None = None
    quickest_pass: LeaderboardAccoladeWinner | None = None
    the_persistent: LeaderboardAccoladeWinner | None = None
    marathon_runner: LeaderboardAccoladeWinner | None = None
    rapid_riser: LeaderboardAccoladeWinner | None = None


class LeaderboardSections(BaseModel):
    """Business-computed section skeletons (built in permissions.py)."""

    header_metrics: LeaderboardHeaderMetrics = Field(
        default_factory=LeaderboardHeaderMetrics
    )
    rankings: LeaderboardSectionStatus = Field(default_factory=LeaderboardSectionStatus)
    accolades: LeaderboardSectionStatus = Field(
        default_factory=LeaderboardSectionStatus
    )
    trends: LeaderboardSectionStatus = Field(default_factory=LeaderboardSectionStatus)
    filters: LeaderboardSectionStatus = Field(default_factory=LeaderboardSectionStatus)
    accolade_winners: LeaderboardAccoladeWinners = Field(
        default_factory=LeaderboardAccoladeWinners
    )


class LeaderboardViews(BaseModel):
    """Raw MV slices used to compute leaderboard sections."""

    attempt_facts: list[AttemptFactsItem] = Field(default_factory=list)
    chat_facts: list[ChatFactsItem] = Field(default_factory=list)
    daily_metrics: list[DailyMetricsItem] = Field(default_factory=list)
    profile_metrics: list[ProfileMetricsItem] = Field(default_factory=list)


class LeaderboardProfileResource(BaseModel):
    profile_id: str | None = None
    name: str | None = None
    role: str | None = None


class LeaderboardSimulationResource(BaseModel):
    simulation_id: str | None = None
    name: str | None = None
    description: str | None = None


class LeaderboardScenarioResource(BaseModel):
    scenario_id: str | None = None
    name: str | None = None
    description: str | None = None


class LeaderboardResources(BaseModel):
    """Resource metadata keyed by ID for normalized hydration."""

    profiles: dict[str, LeaderboardProfileResource] = Field(default_factory=dict)
    simulations: dict[str, LeaderboardSimulationResource] = Field(default_factory=dict)
    scenarios: dict[str, LeaderboardScenarioResource] = Field(default_factory=dict)


class LeaderboardResponse(BaseModel):
    """Target leaderboard artifact bundle shape."""

    sections: LeaderboardSections = Field(default_factory=LeaderboardSections)
    data: list[LeaderboardDataRow] = Field(default_factory=list)
    views: LeaderboardViews = Field(default_factory=LeaderboardViews)
    resources: LeaderboardResources = Field(default_factory=LeaderboardResources)
    primary_color: str | None = None
    accent_color: str | None = None
    total_count: int = Field(default=0)

    simulation_options: list[FilterOption] = Field(default_factory=list)
    profile_options: list[FilterOption] = Field(default_factory=list)
    cohort_options: list[FilterOption] = Field(default_factory=list)
    department_options: list[FilterOption] = Field(default_factory=list)
    date_range_earliest: str | None = None
    date_range_latest: str | None = None
