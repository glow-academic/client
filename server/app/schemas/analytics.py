"""Analytics request and response schemas."""

from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel

from .base import (ParameterItemMapping, ParameterMapping, RubricMapping,
                   ScenarioMapping, SimulationMapping, StandardGroupsMapping,
                   StandardsMapping)


# Enums
class ProfileRole(str, Enum):
    """Profile role enum matching database."""

    STUDENT = "student"
    INSTRUCTOR = "instructor"
    TA = "ta"


class SimulationFilter(str, Enum):
    """Simulation filter types."""

    GENERAL = "general"
    PRACTICE = "practice"
    ARCHIVED = "archived"


class Method(str, Enum):
    """Analytics computation methods."""

    AVG = "avg"
    MAX = "max"
    SUM = "sum"
    RATE = "rate"
    COUNT_DISTINCT = "countDistinct"
    MIN = "min"
    SLOPE = "slope"


# Request Schemas
class AnalyticsFilters(BaseModel):
    """Analytics filter request schema."""

    startDate: str
    endDate: str
    cohortIds: Optional[List[str]] = None
    roles: Optional[List[str]] = None
    simulationFilters: Optional[List[SimulationFilter]] = None
    profileId: Optional[str] = None
    departmentIds: Optional[List[str]] = None


# Basic Response Schemas
class TrendData(BaseModel):
    """Trend data point."""

    date: str
    value: float
    count: int


class DataPoint(BaseModel):
    """Individual data point."""

    profileId: str
    date: Optional[str] = None
    value: Optional[float] = None
    attemptId: Optional[str] = None
    simulationId: Optional[str] = None
    scenarioId: Optional[str] = None
    count: Optional[int] = None


class MetricResponse(BaseModel):
    """Standard metric response."""

    hasData: bool
    method: Method
    valueField: Optional[str] = None
    keyField: Optional[str] = None
    trendData: List[TrendData]
    dataPoints: List[DataPoint]


# Primary Analytics Schemas
class RubricHeatmapCell(BaseModel):
    """Heatmap cell data."""

    rubricId: str
    correlation: float
    pValue: Optional[float] = None
    color: str
    strength: str
    dataPoints: int


class StandardGroup(BaseModel):
    """Standard group information."""

    id: str
    name: str
    shortName: Optional[str] = None
    rubricId: str


class RubricMatrixPackage(BaseModel):
    """Per-rubric matrix package."""

    rubricId: str
    standardGroups: List[StandardGroup]
    matrix: List[List[RubricHeatmapCell]]
    insights: Optional[str] = None
    hasData: bool


class RubricHeatmapResponse(BaseModel):
    """Rubric heatmap response."""

    matrices: List[RubricMatrixPackage]
    validRubricIds: List[str]


class GrowthDataPoint(BaseModel):
    """Growth data point."""

    date: str
    averageScore: Optional[float] = None
    passRate: Optional[float] = None
    completionRate: Optional[float] = None
    firstAttemptPassRate: Optional[float] = None
    messagesPerSession: Optional[float] = None
    personaResponseTimes: Optional[float] = None
    sessionEfficiency: Optional[float] = None
    stagnationRate: Optional[float] = None
    timeSpent: Optional[float] = None
    totalAttempts: Optional[float] = None


class GrowthMetric(BaseModel):
    """Growth metric metadata."""

    id: str
    name: str
    color: str
    unit: str
    description: str
    formatterId: Literal["percent", "int", "sec", "min", "hours", "minutes"]


class GrowthWindowAverage(BaseModel):
    """Growth window average."""

    n: int
    last: Optional[float] = None
    prev: Optional[float] = None


class GrowthWindowAverages(BaseModel):
    """Growth window averages collection."""

    averageScore: GrowthWindowAverage


class GrowthDataResponse(BaseModel):
    """Growth data response."""

    chartData: List[GrowthDataPoint]
    availableMetrics: List[GrowthMetric]
    windowAverages: GrowthWindowAverages


class PersonaTrendData(BaseModel):
    """Persona trend data point."""

    date: str
    score: Optional[float] = None
    timestamp: int
    simulationId: Optional[str] = None


class PersonaPerformanceData(BaseModel):
    """Persona performance data."""

    name: str
    score: float
    sessions: int
    color: str
    simulationIds: Optional[List[str]] = None
    trendData: List[PersonaTrendData]


class PersonaPerformanceResponse(BaseModel):
    """Persona performance response."""

    chartData: List[PersonaPerformanceData]
    validSimulationIds: List[str]
    personaColors: dict[str, str]


# Secondary Analytics Schemas
class AttemptImprovementData(BaseModel):
    """Attempt improvement data."""

    attempt: str
    average_score: float = 0
    average_time: float = 0
    pass_rate: float = 0

    class Config:
        populate_by_name = True
        fields = {
            "average_score": {"alias": "Average Score"},
            "average_time": {"alias": "Average Time"},
            "pass_rate": {"alias": "Pass Rate"},
        }


class AttemptImprovementFact(BaseModel):
    """Attempt improvement fact."""

    simulationId: str
    attemptNo: int
    avgGrade: float
    avgMinutes: float
    passRate: float


class AttemptImprovementResponse(BaseModel):
    """Attempt improvement response."""

    chartData: List[AttemptImprovementData]
    facts: List[AttemptImprovementFact]
    validSimulationIds: List[str]


class CohortData(BaseModel):
    """Cohort data."""

    id: str
    name: str
    passRate: float
    avgPercentageScore: float
    totalStudents: int
    passedStudents: int
    totalAttempts: int
    passedAttempts: int
    simulationCount: int
    requiredSimulations: int


class DailyData(BaseModel):
    """Daily data point."""

    date: str
    avgScore: float
    cohortId: Optional[str] = None


class CohortFact(BaseModel):
    """Cohort fact."""

    cohortId: str
    simulationId: str
    passRate: float
    avgScore: float
    attempts: int


class CohortDailyFact(BaseModel):
    """Cohort daily fact."""

    date: str
    simulationId: str
    avgScore: float


class CohortPerformanceResponse(BaseModel):
    """Cohort performance response."""

    cohortData: List[CohortData]
    dailyData: List[DailyData]
    cohortFacts: List[CohortFact]
    dailyFacts: List[CohortDailyFact]
    validSimulationIds: List[str]


class SkillRadarData(BaseModel):
    """Skill radar data."""

    metric: str
    description: Optional[str] = None
    value: float
    fullMark: float


class SkillStandardFact(BaseModel):
    """Skill standard fact."""

    groupId: str
    groupName: str
    groupDescription: Optional[str] = None
    simulationId: str
    score: float
    points: float
    avgPct: float


class SkillPackage(BaseModel):
    """Skill package."""

    rubricId: str
    radarData: List[SkillRadarData]
    groupFacts: List[SkillStandardFact]


class SkillPerformanceResponse(BaseModel):
    """Skill performance response."""

    packages: List[SkillPackage]
    validRubricIds: List[str]


# Footer Analytics Schemas
class ScenarioAttributeAttemptFact(BaseModel):
    """Scenario attribute attempt fact."""

    parameterId: str
    parameterItemId: str
    date: str
    timestamp: int
    avgScore: float
    attempts: int
    passedAttempts: int


class ScenarioAttributeScenarioFact(BaseModel):
    """Scenario attribute scenario fact."""

    parameterId: str
    parameterItemId: str
    scenarioId: str


class ScenarioPerformanceResponse(BaseModel):
    """Scenario performance response."""

    validParameterIds: List[str]
    attributeAttemptFacts: List[ScenarioAttributeAttemptFact]
    attributeScenarioFacts: List[ScenarioAttributeScenarioFact]


class NumericAttemptFact(BaseModel):
    """Numeric attempt fact."""

    parameterId: str
    levelLabel: str
    levelValue: float
    score: float
    attempts: int


class NumericScenarioFact(BaseModel):
    """Numeric scenario fact."""

    parameterId: str
    scenarioId: str
    levelLabel: str
    levelValue: float


class ScenarioStatsResponse(BaseModel):
    """Scenario stats response."""

    validNumericParameterIds: List[str]
    numericAttemptFacts: List[NumericAttemptFact]
    numericScenarioFacts: List[NumericScenarioFact]


class SimulationFact(BaseModel):
    """Simulation fact."""

    simulationId: str
    title: str
    avgScore: float
    completionRate: float
    totalAttempts: int
    scenarioCount: int


class SimulationParameterFactCategorical(BaseModel):
    """Simulation parameter fact (categorical)."""

    simulationId: str
    parameterId: str
    parameterItemId: str
    scenarioCount: int


class SimulationParameterFactNumeric(BaseModel):
    """Simulation parameter fact (numeric)."""

    simulationId: str
    parameterId: str
    avgLevel: float
    levelLabel: str
    scenarioCount: int


class SimulationCompositionResponse(BaseModel):
    """Simulation composition response."""

    validSimulationIds: List[str]
    simulationFacts: List[SimulationFact]
    simulationParameterFactsCategorical: List[SimulationParameterFactCategorical]
    simulationParameterFactsNumeric: List[SimulationParameterFactNumeric]
    hasData: bool


class ScenarioFact(BaseModel):
    """Scenario fact."""

    simulationId: str
    scenarioId: str
    scenarioName: str
    avgScore: float
    successRate: float
    totalAttempts: int
    completedAttempts: int


class SimulationPerformanceResponse(BaseModel):
    """Simulation performance response."""

    validSimulationIds: List[str]
    scenarioFacts: List[ScenarioFact]


# Page-specific Analytics Schemas
class HomeSimulationItem(BaseModel):
    """Home simulation item."""

    viewMode: Literal["ta", "instructional"]
    id: str
    simulationTitle: str
    simulationDescription: Optional[str] = None
    simulationName: str
    timeLimit: Optional[int] = None
    numSessions: int
    highestScore: Optional[float] = None
    standard_groups: Dict[str, List[str]]
    color: Optional[str] = None
    icon: Optional[str] = None
    hasPassed: Optional[bool] = None
    passRate: Optional[float] = None
    cohortName: Optional[str] = None
    cohortNames: Optional[str] = None
    orderIndex: Optional[int] = None
    status: Literal["not-started", "in-progress", "passed"]
    completionPct: float
    passedCount: Optional[int] = None
    inProgressCount: Optional[int] = None
    notStartedCount: Optional[int] = None
    passPct: Optional[float] = None


class HomeOverviewResponse(BaseModel):
    """Home overview response with mappings and history."""

    mode: Literal["ta", "instructional", "empty"]
    hasData: bool
    items: List[HomeSimulationItem]
    history: AttemptHistoryResponse
    standard_groups_mapping: StandardGroupsMapping
    standards_mapping: StandardsMapping
    simulation_mapping: SimulationMapping


class PracticeSimulationItem(BaseModel):
    """Practice simulation item."""

    viewMode: Literal["practice"]
    id: str
    simulationTitle: str
    simulationDescription: Optional[str] = None
    simulationName: str
    timeLimit: Optional[int] = None
    numSessions: int
    highestScore: Optional[float] = None
    standard_groups: Dict[str, List[str]]
    color: Optional[str] = None
    icon: Optional[str] = None
    hasPassed: Optional[bool] = None
    passRate: Optional[float] = None
    status: Optional[Literal["not-started", "in-progress", "passed"]] = None
    completionPct: Optional[float] = None
    passedCount: Optional[int] = None
    inProgressCount: Optional[int] = None
    notStartedCount: Optional[int] = None
    passPct: Optional[float] = None
    cohortName: Optional[str] = None
    updatedAt: Optional[str] = None
    lastActivityTs: Optional[str] = None
    hasActivity: Optional[bool] = None


class PracticeOverviewResponse(BaseModel):
    """Practice overview response with mappings and history."""

    mode: Literal["practice"]
    hasData: bool
    items: List[PracticeSimulationItem]
    history: AttemptHistoryResponse
    standard_groups_mapping: StandardGroupsMapping
    standards_mapping: StandardsMapping
    simulation_mapping: SimulationMapping


class AttemptHistoryRow(BaseModel):
    """Attempt history row."""

    attemptId: str
    date: str
    profileId: str
    profileName: str
    simulationName: str
    numScenarios: Optional[int] = None
    numScenariosCompleted: int
    infiniteMode: bool
    infiniteModeTimeLimit: Optional[int] = None
    personaNames: List[str]
    personaColors: List[str]
    score: Optional[float] = None
    simulation_id: str
    department_id: str
    scenario_ids: List[str]
    scenario_titles: Optional[List[str]] = None
    isArchived: bool
    showView: bool
    showContinue: bool
    practiceSimulation: bool
    passPct: Optional[float] = None


AttemptHistoryResponse = List[AttemptHistoryRow]


# Reports Bundle Schemas
class AverageScoreHover(BaseModel):
    """Average score hover data."""

    mean: float
    median: float
    mode: float


class CompletionPercentageHover(BaseModel):
    """Completion percentage hover data."""

    completed: int
    total: int
    percent: float


class FirstAttemptPassRateHover(BaseModel):
    """First attempt pass rate hover data."""

    passed: int
    total: int
    percent: float


class HighestScoreHover(BaseModel):
    """Highest score hover data."""

    top: List[float]


class MessagesPerSessionHover(BaseModel):
    """Messages per session hover data."""

    mean: float
    median: float
    count: int


class PersonaResponseTimesHover(BaseModel):
    """Persona response times hover data."""

    meanSeconds: float
    medianSeconds: float
    samples: int


class SessionEfficiencyHover(BaseModel):
    """Session efficiency hover data."""

    avgScorePercent: float
    avgMinutes: float
    efficiency: float


class StagnationRateHover(BaseModel):
    """Stagnation rate hover data."""

    tracked: int
    stagnant: int
    ratePercent: float


class TimeSpentHover(BaseModel):
    """Time spent hover data."""

    avgSessionMinutes: float
    avgChatMinutes: float
    avgOverallMinutes: float


class TotalAttemptsHover(BaseModel):
    """Total attempts hover data."""

    attempts: int
    uniqueSimulations: int
    perSimulationMean: float


class AverageScoreMetricResponse(MetricResponse):
    """Average score metric response."""

    hover: AverageScoreHover


class CompletionPercentageMetricResponse(MetricResponse):
    """Completion percentage metric response."""

    hover: CompletionPercentageHover


class FirstAttemptPassRateMetricResponse(MetricResponse):
    """First attempt pass rate metric response."""

    hover: FirstAttemptPassRateHover


class HighestScoreMetricResponse(MetricResponse):
    """Highest score metric response."""

    hover: HighestScoreHover


class MessagesPerSessionMetricResponse(MetricResponse):
    """Messages per session metric response."""

    hover: MessagesPerSessionHover


class PersonaResponseTimesMetricResponse(MetricResponse):
    """Persona response times metric response."""

    hover: PersonaResponseTimesHover


class SessionEfficiencyMetricResponse(MetricResponse):
    """Session efficiency metric response."""

    hover: SessionEfficiencyHover


class StagnationRateMetricResponse(MetricResponse):
    """Stagnation rate metric response."""

    hover: StagnationRateHover


class TimeSpentMetricResponse(MetricResponse):
    """Time spent metric response."""

    hover: TimeSpentHover


class TotalAttemptsMetricResponse(MetricResponse):
    """Total attempts metric response."""

    hover: TotalAttemptsHover


class ProfileMetrics(BaseModel):
    """Profile metrics bundle."""

    averageScore: AverageScoreMetricResponse
    completionPercentage: CompletionPercentageMetricResponse
    firstAttemptPassRate: FirstAttemptPassRateMetricResponse
    highestScore: HighestScoreMetricResponse
    messagesPerSession: MessagesPerSessionMetricResponse
    personaResponseTimes: PersonaResponseTimesMetricResponse
    sessionEfficiency: SessionEfficiencyMetricResponse
    stagnationRate: StagnationRateMetricResponse
    timeSpent: TimeSpentMetricResponse
    totalAttempts: TotalAttemptsMetricResponse


class ProfileData(BaseModel):
    """Profile data."""

    profileId: str
    metrics: ProfileMetrics


class ProfileDataEnhanced(BaseModel):
    """Enhanced profile data with embedded profile info."""

    profileId: str
    firstName: str
    lastName: str
    alias: str
    role: str
    metrics: ProfileMetrics


class ReportsBundleResponse(BaseModel):
    """Reports bundle response with entity mappings."""

    data: List[ProfileDataEnhanced]
    scenario_mapping: ScenarioMapping
    simulation_mapping: SimulationMapping


# Leaderboard Bundle Schemas
class LeaderboardMetric(BaseModel):
    """Leaderboard metric."""

    hasData: bool
    method: str
    keyField: Optional[str] = None
    trendData: List[Any]
    dataPoints: List[Any]
    hover: dict[str, Any]


class LeaderboardMetrics(BaseModel):
    """Leaderboard metrics."""

    totalAttempts: LeaderboardMetric
    highestScoreAvg: LeaderboardMetric
    messagesPerSession: LeaderboardMetric
    personaResponseSeconds: LeaderboardMetric
    timeSpentMinutes: LeaderboardMetric
    improvementRatePerDay: LeaderboardMetric
    perfectScoreCount: LeaderboardMetric
    quickestPassMinutes: LeaderboardMetric


class LeaderboardRow(BaseModel):
    """Leaderboard row."""

    profileId: str
    firstName: str
    lastName: str
    metrics: LeaderboardMetrics


class LeaderboardBundleResponse(BaseModel):
    """Leaderboard bundle response."""

    data: List[LeaderboardRow]


# Utility Schemas
class RefreshResponse(BaseModel):
    """Refresh materialized view response."""

    success: bool
    message: str
    status: str


# ============================================================================
# PRICING ANALYTICS SCHEMAS
# ============================================================================


class DebugInfoItem(BaseModel):
    """Debug info item."""

    id: str
    created_at: str
    content: str


class ModelRunItem(BaseModel):
    """Model run item for pricing analytics."""

    model_run_id: str
    created_at: str
    input_tokens: int
    output_tokens: int
    model_id: Optional[str]
    profile_id: Optional[str]
    agent_id: Optional[str]
    persona_id: Optional[str]
    debug_info: List[DebugInfoItem]


class ModelMappingWithPricing(BaseModel):
    """Model mapping with pricing information."""

    name: str
    description: str
    input_ppm: float
    output_ppm: float


class PricingAnalyticsResponse(BaseModel):
    """Response for pricing analytics."""

    model_runs: List[ModelRunItem]
    model_mapping: dict[str, ModelMappingWithPricing]
    profile_mapping: dict[str, str]
    agent_mapping: dict[str, str]
    persona_mapping: dict[str, str]


# ============================================================================
# DASHBOARD BUNDLE SCHEMAS
# ============================================================================


class DashboardHeaderMetrics(BaseModel):
    """Header metrics (10 total)."""

    average_score: MetricResponse
    completion_percentage: MetricResponse
    first_attempt_pass_rate: MetricResponse
    highest_score: MetricResponse
    messages_per_session: MetricResponse
    persona_response_times: MetricResponse
    session_efficiency: MetricResponse
    stagnation_rate: MetricResponse
    time_spent: MetricResponse
    total_attempts: MetricResponse


class DashboardPrimaryMetrics(BaseModel):
    """Primary metrics (3 total)."""

    growth_data: GrowthDataResponse
    persona_performance: PersonaPerformanceResponse
    rubric_heatmap: RubricHeatmapResponse


class DashboardSecondaryMetrics(BaseModel):
    """Secondary metrics (3 total)."""

    attempt_improvement: AttemptImprovementResponse
    cohort_performance: CohortPerformanceResponse
    skill_performance: SkillPerformanceResponse


class DashboardFooterMetrics(BaseModel):
    """Footer metrics (4 total)."""

    scenario_performance: ScenarioPerformanceResponse
    scenario_stats: ScenarioStatsResponse
    simulation_performance: SimulationPerformanceResponse
    simulation_composition: SimulationCompositionResponse


class DashboardInsights(BaseModel):
    """Actionable insights (computed server-side)."""

    growth: Optional[str] = None
    persona: dict[str, Optional[str]]  # persona_name -> insight
    rubric_heatmap: Optional[str] = None
    attempt_improvement: Optional[str] = None
    cohort: dict[str, Optional[str]]  # cohort_id -> insight
    skill_performance: Optional[str] = None
    scenario_performance: Optional[str] = None
    scenario_stats: Optional[str] = None
    simulation_performance: Optional[str] = None
    simulation_composition: Optional[str] = None


class DashboardBundleResponse(BaseModel):
    """Complete dashboard bundle with all metrics, history, insights, and mappings."""

    header: DashboardHeaderMetrics
    primary: DashboardPrimaryMetrics
    secondary: DashboardSecondaryMetrics
    footer: DashboardFooterMetrics
    history: AttemptHistoryResponse
    insights: DashboardInsights

    # Normalized entity mappings (from base.py)
    simulation_mapping: SimulationMapping
    rubric_mapping: RubricMapping
    parameter_mapping: ParameterMapping
    parameter_item_mapping: ParameterItemMapping

