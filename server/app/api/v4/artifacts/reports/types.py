"""Types for reports artifact get bundle."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.views.analytics.attempts.types import AttemptFactsItem
from app.api.v4.views.analytics.chat_facts.types import ChatFactsItem
from app.api.v4.views.analytics.daily_metrics.types import DailyMetricsItem
from app.api.v4.views.analytics.profile_metrics.types import ProfileMetricsItem


class ReportsRequest(BaseModel):
    """Request for getting reports artifact bundle."""

    start_date: str | None = None
    end_date: str | None = None
    cohort_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    roles: list[str] | None = None
    simulation_filters: list[str] | None = None
    actor_profile_id: UUID | None = None
    target_profile_id: UUID | None = None

    profile_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    search: str | None = None
    sort_by: str = Field(default="date")
    sort_order: str = Field(default="desc")

    page_limit: int = Field(default=50, ge=1, le=200)
    page_offset: int = Field(default=0, ge=0)


class ReportsMetric(BaseModel):
    """Small, reusable metric envelope for section outputs."""

    current_value: float | int | None = None
    has_data: bool = False
    status: str = "neutral"


class ReportsHeaderMetrics(BaseModel):
    """Header summary metrics."""

    total_attempts: ReportsMetric = Field(default_factory=ReportsMetric)
    average_score: ReportsMetric = Field(default_factory=ReportsMetric)
    completion_percentage: ReportsMetric = Field(default_factory=ReportsMetric)
    first_attempt_pass_rate: ReportsMetric = Field(default_factory=ReportsMetric)


class ReportsSectionStatus(BaseModel):
    """Section-level status metadata."""

    has_data: bool = False
    status: str = "neutral"
    note: str | None = None


class ReportsOverviewRow(BaseModel):
    """Overview row grouped by simulation."""

    simulation_id: str | None = None
    attempts: int = 0
    completed_attempts: int = 0
    passed_attempts: int = 0
    average_score: float | None = None
    completion_percentage: float | None = None
    pass_rate: float | None = None


class ReportsOverviewSection(BaseModel):
    """Overview section output."""

    status: ReportsSectionStatus = Field(default_factory=ReportsSectionStatus)
    rows: list[ReportsOverviewRow] = Field(default_factory=list)


class ReportsLeaderboardRow(BaseModel):
    """Leaderboard row from profile metrics."""

    rank: int
    profile_id: str | None = None
    total_attempts: int = 0
    average_score: float | None = None
    highest_score: float | None = None
    completion_percentage: float | None = None
    first_attempt_pass_rate: float | None = None


class ReportsLeaderboardSection(BaseModel):
    """Leaderboard section output."""

    status: ReportsSectionStatus = Field(default_factory=ReportsSectionStatus)
    rows: list[ReportsLeaderboardRow] = Field(default_factory=list)


class ReportsTrendPoint(BaseModel):
    """Time-series aggregate point."""

    date: date | str | None = None
    attempts: int = 0
    completed_attempts: int = 0
    passed_attempts: int = 0
    average_score: float | None = None
    completion_percentage: float | None = None
    pass_rate: float | None = None


class ReportsTrendsSection(BaseModel):
    """Trends section output."""

    status: ReportsSectionStatus = Field(default_factory=ReportsSectionStatus)
    chart_data: list[ReportsTrendPoint] = Field(default_factory=list)


class ReportsHistoryRow(BaseModel):
    """History row from attempt facts."""

    attempt_id: str | None = None
    profile_id: str | None = None
    simulation_id: str | None = None
    cohort_id: str | None = None
    attempt_created_at: datetime | None = None
    attempt_type: str | None = None
    is_archived: bool = False
    infinite_mode: bool = False
    score_percent: float | None = None
    has_passed: bool = False
    num_chats: int = 0
    num_chats_completed: int = 0
    total_time_seconds: int = 0
    scenario_ids: list[str] = Field(default_factory=list)


class ReportsHistorySection(BaseModel):
    """History section output."""

    status: ReportsSectionStatus = Field(default_factory=ReportsSectionStatus)
    rows: list[ReportsHistoryRow] = Field(default_factory=list)


class ReportsSections(BaseModel):
    """Business-computed section skeletons (built in permissions.py)."""

    header_metrics: ReportsHeaderMetrics = Field(default_factory=ReportsHeaderMetrics)
    overview: ReportsOverviewSection = Field(default_factory=ReportsOverviewSection)
    leaderboard: ReportsLeaderboardSection = Field(
        default_factory=ReportsLeaderboardSection
    )
    trends: ReportsTrendsSection = Field(default_factory=ReportsTrendsSection)
    history: ReportsHistorySection = Field(default_factory=ReportsHistorySection)


class ReportsViews(BaseModel):
    """Raw MV slices used to compute section outputs."""

    attempt_facts: list[AttemptFactsItem] = Field(default_factory=list)
    chat_facts: list[ChatFactsItem] = Field(default_factory=list)
    daily_metrics: list[DailyMetricsItem] = Field(default_factory=list)
    profile_metrics: list[ProfileMetricsItem] = Field(default_factory=list)


class ReportsSimulationResource(BaseModel):
    simulation_id: str | None = None
    name: str | None = None
    description: str | None = None


class ReportsProfileResource(BaseModel):
    profile_id: str | None = None
    name: str | None = None
    role: str | None = None


class ReportsScenarioResource(BaseModel):
    scenario_id: str | None = None
    name: str | None = None
    description: str | None = None


class ReportsCohortResource(BaseModel):
    cohort_id: str | None = None
    name: str | None = None


class ReportsPersonaResource(BaseModel):
    persona_id: str | None = None
    name: str | None = None
    color: str | None = None
    icon: str | None = None


class ReportsRubricResource(BaseModel):
    rubric_id: str | None = None
    name: str | None = None
    description: str | None = None


class ReportsResources(BaseModel):
    """Resource metadata keyed by ID for normalized hydration."""

    simulations: dict[str, ReportsSimulationResource] = Field(default_factory=dict)
    profiles: dict[str, ReportsProfileResource] = Field(default_factory=dict)
    scenarios: dict[str, ReportsScenarioResource] = Field(default_factory=dict)
    cohorts: dict[str, ReportsCohortResource] = Field(default_factory=dict)
    personas: dict[str, ReportsPersonaResource] = Field(default_factory=dict)
    rubrics: dict[str, ReportsRubricResource] = Field(default_factory=dict)


class ReportsResponse(BaseModel):
    """Target reports artifact bundle shape."""

    sections: ReportsSections = Field(default_factory=ReportsSections)
    views: ReportsViews = Field(default_factory=ReportsViews)
    resources: ReportsResources = Field(default_factory=ReportsResources)
    total_count: int = Field(default=0)
