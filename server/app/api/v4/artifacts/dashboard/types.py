"""Types for dashboard artifact get bundle."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.artifacts.types import (
    FilterOption,
    HistoryResponse,
    InternalResponseBase,
)
from app.api.v4.entries.runs.search import GetRunListViewResponse

# ============================================================================
# Request
# ============================================================================


class DashboardRequest(BaseModel):
    """Request for getting dashboard data (get.py scope only)."""

    # Global filters
    start_date: str | None = None
    end_date: str | None = None
    cohort_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    roles: list[str] | None = None
    simulation_filters: list[str] | None = None
    actor_profile_id: UUID | None = None
    target_profile_id: UUID | None = None
    page_limit: int = Field(default=50, ge=1, le=200)
    page_offset: int = Field(default=0, ge=0)

    # Section pickers (canonical — shared across charts in each section)
    rubric_ids: list[UUID] | None = None
    rubric_search: str | None = None
    simulation_picker_ids: list[UUID] | None = None
    simulation_picker_search: str | None = None
    parameter_ids: list[UUID] | None = None
    parameter_search: str | None = None
    scenario_ids: list[UUID] | None = None
    scenario_search: str | None = None

    # History section (attempt list)
    history_practice: bool = False
    history_scenario_ids: list[UUID] | None = None
    history_infinite_mode: bool | None = None
    history_show_archived: bool = False
    history_sort_by: str | None = "date"
    history_sort_order: str | None = "desc"
    history_page: int = 0
    history_page_size: int = 20
    history_simulation_search: str | None = None
    history_scenario_search: str | None = None
    history_profile_search: str | None = None


# ============================================================================
# Target client bundle response shape
# ============================================================================


class DashboardTrendPoint(BaseModel):
    date: date | str | None = None
    value: float | None = None
    count: int | None = None


class DashboardHeaderMetric(BaseModel):
    current_value: float | int | None = None
    trend_data: list[DashboardTrendPoint] = Field(default_factory=list)
    has_data: bool = False
    trend_analysis: str | None = None
    status: str = "neutral"


class DashboardHeaderMetrics(BaseModel):
    average_score: DashboardHeaderMetric = Field(default_factory=DashboardHeaderMetric)
    completion_percentage: DashboardHeaderMetric = Field(
        default_factory=DashboardHeaderMetric
    )
    first_attempt_pass_rate: DashboardHeaderMetric = Field(
        default_factory=DashboardHeaderMetric
    )
    highest_score: DashboardHeaderMetric = Field(default_factory=DashboardHeaderMetric)
    messages_per_session: DashboardHeaderMetric = Field(
        default_factory=DashboardHeaderMetric
    )
    persona_response_times: DashboardHeaderMetric = Field(
        default_factory=DashboardHeaderMetric
    )
    session_efficiency: DashboardHeaderMetric = Field(
        default_factory=DashboardHeaderMetric
    )
    stagnation_rate: DashboardHeaderMetric = Field(
        default_factory=DashboardHeaderMetric
    )
    time_spent: DashboardHeaderMetric = Field(default_factory=DashboardHeaderMetric)
    total_attempts: DashboardHeaderMetric = Field(default_factory=DashboardHeaderMetric)


class GrowthChartPoint(BaseModel):
    date: str | None = None
    average_score: float | None = None
    completion_rate: float | None = None
    first_attempt_pass_rate: float | None = None
    session_efficiency: float | None = None
    stagnation_rate: float | None = None


class GrowthAvailableMetric(BaseModel):
    id: str | None = None
    name: str | None = None
    color: str | None = None
    unit: str | None = None
    description: str | None = None
    formatter_id: str | None = None


class GrowthWindowAverage(BaseModel):
    n: int = 0
    last: float | None = None
    prev: float | None = None


class GrowthWindowAverages(BaseModel):
    average_score: GrowthWindowAverage = Field(default_factory=GrowthWindowAverage)


class PrimaryGrowthData(BaseModel):
    chart_data: list[GrowthChartPoint] = Field(default_factory=list)
    available_metrics: list[GrowthAvailableMetric] = Field(default_factory=list)
    window_averages: GrowthWindowAverages | None = None
    status: str = "neutral"


class PersonaTrendPoint(BaseModel):
    date: str | None = None
    score: float | None = None
    timestamp: int | None = None
    simulation_id: str | None = None


class PersonaChartRow(BaseModel):
    name: str | None = None
    score: float | None = None
    sessions: int | None = None
    color: str | None = None
    trend_data: list[PersonaTrendPoint] = Field(default_factory=list)
    simulation_ids: list[str] = Field(default_factory=list)
    status: str = "neutral"


class PersonaColorJunction(BaseModel):
    persona_name: str | None = None
    color: str | None = None


class PrimaryPersonaPerformance(BaseModel):
    chart_data: list[PersonaChartRow] = Field(default_factory=list)
    valid_simulation_ids: list[str] = Field(default_factory=list)
    persona_colors_junction: list[PersonaColorJunction] = Field(default_factory=list)
    status: str = "neutral"


class RubricHeatmapStandardGroup(BaseModel):
    id: str | None = None
    name: str | None = None
    short_name: str | None = None
    rubric_id: str | None = None


class RubricHeatmapCell(BaseModel):
    rubric_id: str | None = None
    correlation: float | None = None
    p_value: float | None = None
    color: str | None = None
    strength: str | None = None
    data_points: int | None = None


class RubricHeatmapMatrixRow(BaseModel):
    cells: list[RubricHeatmapCell] = Field(default_factory=list)


class RubricHeatmapMatrix(BaseModel):
    rubric_id: str | None = None
    standard_groups: list[RubricHeatmapStandardGroup] = Field(default_factory=list)
    matrix: list[RubricHeatmapMatrixRow] = Field(default_factory=list)
    insights: str | None = None
    has_data: bool = False


class PrimaryRubricHeatmap(BaseModel):
    matrices: list[RubricHeatmapMatrix] = Field(default_factory=list)
    valid_rubric_ids: list[str] = Field(default_factory=list)
    status: str = "neutral"


class PrimaryRubricTrendPoint(BaseModel):
    date: str | None = None
    standard_group_id: str | None = None
    standard_group_name: str | None = None
    avg_pct: float | None = None


class PrimaryRubricTrend(BaseModel):
    trend_data: list[PrimaryRubricTrendPoint] = Field(default_factory=list)
    valid_rubric_ids: list[str] = Field(default_factory=list)
    status: str = "neutral"


class DashboardPrimaryMetrics(BaseModel):
    rubric_heatmap: PrimaryRubricHeatmap = Field(default_factory=PrimaryRubricHeatmap)
    rubric_trend: PrimaryRubricTrend = Field(default_factory=PrimaryRubricTrend)
    skill_performance: "SecondarySkillPerformance" = Field(
        default_factory=lambda: SecondarySkillPerformance()
    )


class SecondaryCohortData(BaseModel):
    id: str | None = None
    name: str | None = None
    pass_rate: float | None = None
    avg_percentage_score: float | None = None
    total_students: int | None = None
    passed_students: int | None = None
    total_attempts: int | None = None
    passed_attempts: int | None = None
    simulation_count: int | None = None
    required_simulations: int | None = None
    status: str = "neutral"


class SecondaryCohortDaily(BaseModel):
    date: str | None = None
    avg_score: float | None = None
    cohort_id: str | None = None


class SecondarySimulationFact(BaseModel):
    cohort_id: str | None = None
    simulation_id: str | None = None
    pass_rate: float | None = None
    avg_score: float | None = None
    attempts: int | None = None


class SecondaryDailyFact(BaseModel):
    date: str | None = None
    simulation_id: str | None = None
    avg_score: float | None = None


class SecondaryCohortPerformance(BaseModel):
    cohort_data: list[SecondaryCohortData] = Field(default_factory=list)
    daily_data: list[SecondaryCohortDaily] = Field(default_factory=list)
    simulation_facts: list[SecondarySimulationFact] = Field(default_factory=list)
    daily_facts: list[SecondaryDailyFact] = Field(default_factory=list)
    valid_simulation_ids: list[str] = Field(default_factory=list)
    status: str = "neutral"


class SecondaryAttemptImprovementChart(BaseModel):
    attempt: str | None = None
    average_score: float | None = None
    average_time: float | None = None
    pass_rate: float | None = None


class SecondaryAttemptImprovementFact(BaseModel):
    simulation_id: str | None = None
    attempt_no: int | None = None
    avg_grade: float | None = None
    avg_minutes: float | None = None
    pass_rate: float | None = None


class SecondaryAttemptImprovement(BaseModel):
    chart_data: list[SecondaryAttemptImprovementChart] = Field(default_factory=list)
    facts: list[SecondaryAttemptImprovementFact] = Field(default_factory=list)
    valid_simulation_ids: list[str] = Field(default_factory=list)
    status: str = "neutral"


class SecondaryRadarPoint(BaseModel):
    metric: str | None = None
    description: str | None = None
    value: float | None = None
    full_mark: float | None = None


class SecondaryGroupFact(BaseModel):
    group_id: str | None = None
    group_name: str | None = None
    group_description: str | None = None
    simulation_id: str | None = None
    score: float | None = None
    points: float | None = None
    avg_pct: float | None = None


class SecondarySkillPackage(BaseModel):
    rubric_id: str | None = None
    radar_data: list[SecondaryRadarPoint] = Field(default_factory=list)
    group_facts: list[SecondaryGroupFact] = Field(default_factory=list)


class SecondarySkillPerformance(BaseModel):
    packages: list[SecondarySkillPackage] = Field(default_factory=list)
    valid_rubric_ids: list[str] = Field(default_factory=list)
    status: str = "neutral"


class DashboardSecondaryMetrics(BaseModel):
    persona_performance: PrimaryPersonaPerformance = Field(
        default_factory=PrimaryPersonaPerformance
    )
    cohort_performance: SecondaryCohortPerformance = Field(
        default_factory=SecondaryCohortPerformance
    )
    attempt_improvement: SecondaryAttemptImprovement = Field(
        default_factory=SecondaryAttemptImprovement
    )


class FooterScenarioAttributeAttemptFact(BaseModel):
    parameter_id: str | None = None
    parameter_item_id: str | None = None
    date: str | None = None
    timestamp: int | None = None
    avg_score: float | None = None
    attempts: int | None = None
    passed_attempts: int | None = None


class FooterScenarioAttributeScenarioFact(BaseModel):
    parameter_id: str | None = None
    parameter_item_id: str | None = None
    scenario_id: str | None = None


class FooterScenarioPerformance(BaseModel):
    attribute_attempt_facts: list[FooterScenarioAttributeAttemptFact] = Field(
        default_factory=list
    )
    attribute_scenario_facts: list[FooterScenarioAttributeScenarioFact] = Field(
        default_factory=list
    )
    valid_parameter_ids: list[str] = Field(default_factory=list)
    status: str = "neutral"


class FooterNumericAttemptFact(BaseModel):
    parameter_id: str | None = None
    level_label: str | None = None
    level_value: float | None = None
    score: float | None = None
    attempts: int | None = None


class FooterNumericScenarioFact(BaseModel):
    parameter_id: str | None = None
    scenario_id: str | None = None
    level_label: str | None = None
    level_value: float | None = None


class FooterScenarioStats(BaseModel):
    numeric_attempt_facts: list[FooterNumericAttemptFact] = Field(default_factory=list)
    numeric_scenario_facts: list[FooterNumericScenarioFact] = Field(
        default_factory=list
    )
    valid_numeric_parameter_ids: list[str] = Field(default_factory=list)
    status: str = "neutral"


class FooterScenarioSimulationFact(BaseModel):
    scenario_id: str | None = None
    simulation_id: str | None = None
    simulation_name: str | None = None
    avg_score: float | None = None
    success_rate: float | None = None
    total_attempts: int | None = None
    completed_attempts: int | None = None


class FooterScenarioSimulationPerformance(BaseModel):
    simulation_facts: list[FooterScenarioSimulationFact] = Field(default_factory=list)
    valid_scenario_ids: list[str] = Field(default_factory=list)
    status: str = "neutral"


class FooterScenarioCompositionSummary(BaseModel):
    """Per-scenario summary with high/low chat split."""

    scenario_id: str | None = None
    name: str | None = None
    total_chats: int | None = None
    high_count: int | None = None
    low_count: int | None = None
    high_avg_score: float | None = None
    low_avg_score: float | None = None


class FooterScenarioCompositionParamFact(BaseModel):
    """Parameter counts per (scenario, group) — group is 'high' or 'low'."""

    scenario_id: str | None = None
    group: str | None = None
    parameter_id: str | None = None
    parameter_item_id: str | None = None
    chat_count: int | None = None


class FooterScenarioComposition(BaseModel):
    scenario_summaries: list[FooterScenarioCompositionSummary] = Field(
        default_factory=list
    )
    chat_parameter_facts: list[FooterScenarioCompositionParamFact] = Field(
        default_factory=list
    )
    valid_scenario_ids: list[str] = Field(default_factory=list)
    status: str = "neutral"


class DashboardFooterMetrics(BaseModel):
    scenario_performance: FooterScenarioPerformance = Field(
        default_factory=FooterScenarioPerformance
    )
    scenario_stats: FooterScenarioStats = Field(default_factory=FooterScenarioStats)
    scenario_simulation_performance: FooterScenarioSimulationPerformance = Field(
        default_factory=FooterScenarioSimulationPerformance
    )
    scenario_composition: FooterScenarioComposition = Field(
        default_factory=FooterScenarioComposition
    )


class DashboardSimulationMeta(BaseModel):
    simulation_id: str | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    time_limit: int | None = None


class DashboardScenarioMeta(BaseModel):
    scenario_id: str | None = None
    name: str | None = None
    description: str | None = None


class DashboardRubricMeta(BaseModel):
    rubric_id: str | None = None
    name: str | None = None
    description: str | None = None


class DashboardParameterMeta(BaseModel):
    parameter_id: str | None = None
    name: str | None = None
    description: str | None = None
    numerical: bool | None = None
    document_parameter: bool | None = None
    persona_parameter: bool | None = None


class DashboardFieldMeta(BaseModel):
    field_id: str | None = None
    name: str | None = None
    description: str | None = None
    parameter_id: str | None = None
    parameter_name: str | None = None


class DashboardInsightObject(BaseModel):
    insight: str | None = None


class DashboardInsights(BaseModel):
    rubric_trend: str | None = None
    rubric_heatmap: str | None = None
    attempt_improvement: str | None = None
    skill_performance: str | None = None
    scenario_performance: str | None = None
    scenario_stats: str | None = None
    scenario_simulation_performance: str | None = None
    scenario_composition: str | None = None
    persona: dict[str, str | DashboardInsightObject | None] | None = None
    cohort: dict[str, str | DashboardInsightObject | None] | None = None


class DashboardThresholds(BaseModel):
    success: float = 0
    warning: float = 0
    danger: float = 0


class DashboardBundleResponse(BaseModel):
    """Target dashboard bundle shape expected by dashboard client."""

    header_metrics: DashboardHeaderMetrics = Field(
        default_factory=DashboardHeaderMetrics
    )
    primary_metrics: DashboardPrimaryMetrics = Field(
        default_factory=DashboardPrimaryMetrics
    )
    secondary_metrics: DashboardSecondaryMetrics = Field(
        default_factory=DashboardSecondaryMetrics
    )
    footer_metrics: DashboardFooterMetrics = Field(
        default_factory=DashboardFooterMetrics
    )

    simulations: list[DashboardSimulationMeta] = Field(default_factory=list)
    scenarios: list[DashboardScenarioMeta] = Field(default_factory=list)
    rubrics: list[DashboardRubricMeta] = Field(default_factory=list)
    parameters: list[DashboardParameterMeta] = Field(default_factory=list)
    fields: list[DashboardFieldMeta] = Field(default_factory=list)

    thresholds: DashboardThresholds | None = None
    insights: DashboardInsights | None = None

    simulation_options: list[FilterOption] = Field(default_factory=list)

    # Profile metadata (populated when target_profile_id is provided)
    profile_name: str | None = None
    profile_emails: list[str] | None = None
    profile_primary_email: str | None = None
    profile_role: str | None = None

    # Attempt history
    history: HistoryResponse | None = None


# Resolve forward reference for DashboardPrimaryMetrics.skill_performance
DashboardPrimaryMetrics.model_rebuild()


# =============================================================================
# WebSocket Types
# =============================================================================


class GetDashboardApiRequest(BaseModel):
    """Request model for get dashboard endpoint."""

    dashboard_id: UUID | None = None
    draft_id: UUID | None = None


class DashboardWebsocketEntries(BaseModel):
    """Entries data for dashboard websocket response."""

    runs: GetRunListViewResponse | None = None


class DashboardWebsocketResources(BaseModel):
    """Hydrated resources for dashboard websocket — selected only."""

    pass


class GetDashboardWebsocketResponse(InternalResponseBase):
    """Websocket-facing dashboard response with hydrated resources."""

    entries: DashboardWebsocketEntries | None = None
    resources: DashboardWebsocketResources
