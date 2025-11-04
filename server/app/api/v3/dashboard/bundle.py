"""Dashboard bundle v3 API endpoint."""

import json
from datetime import datetime
from typing import Annotated, Any, Literal

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.schema import (AnalyticsFilters, DataPoint, Method,
                              MetricResponse, ParameterItemMapping,
                              ParameterMapping, RubricMapping,
                              SimulationFilter, SimulationMapping, TrendData)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()

# AttemptHistoryRow schema (moved from app.schemas.home for dashboard use)
class AttemptHistoryRow(BaseModel):
    """Attempt history row."""

    attemptId: str
    date: str
    profileId: str
    profileName: str
    simulationName: str
    numScenarios: int | None = None
    numScenariosCompleted: int
    infiniteMode: bool
    timeLimit: int | None = (
        None  # simulation time limit in seconds (from simulation_time_limits)
    )
    personaNames: list[str]
    personaColors: list[str]
    score: int | None = None
    simulation_id: str
    scenario_ids: list[str]
    scenario_titles: list[str]
    isArchived: bool
    showView: bool
    showContinue: bool
    practiceSimulation: bool
    passPct: int | None = None
    department_ids: list[str] | None = None  # Simulation's department associations
    cohortNames: list[str]


AttemptHistoryResponse = list[AttemptHistoryRow]

# Inline schemas (moved from app.schemas.dashboard)
class RubricHeatmapCell(BaseModel):
    """Heatmap cell data."""

    rubricId: str
    correlation: float
    pValue: float | None = None
    color: str
    strength: str
    dataPoints: int


class StandardGroup(BaseModel):
    """Standard group information."""

    id: str
    name: str
    shortName: str | None = None
    rubricId: str


class RubricMatrixPackage(BaseModel):
    """Per-rubric matrix package."""

    rubricId: str
    standardGroups: list[StandardGroup]
    matrix: list[list[RubricHeatmapCell]]
    insights: str | None = None
    hasData: bool


class RubricHeatmapResponse(BaseModel):
    """Rubric heatmap response."""

    matrices: list[RubricMatrixPackage]
    validRubricIds: list[str]


class GrowthDataPoint(BaseModel):
    """Growth data point."""

    date: str
    averageScore: float | None = None
    passRate: float | None = None
    completionRate: float | None = None
    firstAttemptPassRate: float | None = None
    messagesPerSession: float | None = None
    personaResponseTimes: float | None = None
    sessionEfficiency: float | None = None
    stagnationRate: float | None = None
    timeSpent: float | None = None
    totalAttempts: float | None = None


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
    last: float | None = None
    prev: float | None = None


class GrowthWindowAverages(BaseModel):
    """Growth window averages collection."""

    averageScore: GrowthWindowAverage


class GrowthDataResponse(BaseModel):
    """Growth data response."""

    chartData: list[GrowthDataPoint]
    availableMetrics: list[GrowthMetric]
    windowAverages: GrowthWindowAverages


class PersonaTrendData(BaseModel):
    """Persona trend data point."""

    date: str
    score: float | None = None
    timestamp: int
    simulationId: str | None = None


class PersonaPerformanceData(BaseModel):
    """Persona performance data."""

    name: str
    score: float
    sessions: int
    color: str
    simulationIds: list[str] | None = None
    trendData: list[PersonaTrendData]


class PersonaPerformanceResponse(BaseModel):
    """Persona performance response."""

    chartData: list[PersonaPerformanceData]
    validSimulationIds: list[str]
    personaColors: dict[str, str]


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

    chartData: list[AttemptImprovementData]
    facts: list[AttemptImprovementFact]
    validSimulationIds: list[str]


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
    cohortId: str | None = None


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

    cohortData: list[CohortData]
    dailyData: list[DailyData]
    cohortFacts: list[CohortFact]
    dailyFacts: list[CohortDailyFact]
    validSimulationIds: list[str]


class SkillRadarData(BaseModel):
    """Skill radar data."""

    metric: str
    description: str | None = None
    value: float
    fullMark: float


class SkillStandardFact(BaseModel):
    """Skill standard fact."""

    groupId: str
    groupName: str
    groupDescription: str | None = None
    simulationId: str
    score: float
    points: float
    avgPct: float


class SkillPackage(BaseModel):
    """Skill package."""

    rubricId: str
    radarData: list[SkillRadarData]
    groupFacts: list[SkillStandardFact]


class SkillPerformanceResponse(BaseModel):
    """Skill performance response."""

    packages: list[SkillPackage]
    validRubricIds: list[str]


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

    validParameterIds: list[str]
    attributeAttemptFacts: list[ScenarioAttributeAttemptFact]
    attributeScenarioFacts: list[ScenarioAttributeScenarioFact]


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

    validNumericParameterIds: list[str]
    numericAttemptFacts: list[NumericAttemptFact]
    numericScenarioFacts: list[NumericScenarioFact]


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

    validSimulationIds: list[str]
    simulationFacts: list[SimulationFact]
    simulationParameterFactsCategorical: list[SimulationParameterFactCategorical]
    simulationParameterFactsNumeric: list[SimulationParameterFactNumeric]
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

    validSimulationIds: list[str]
    scenarioFacts: list[ScenarioFact]


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

    growth: str | None = None
    persona: dict[str, str | None]  # persona_name -> insight
    rubric_heatmap: str | None = None
    attempt_improvement: str | None = None
    cohort: dict[str, str | None]  # cohort_id -> insight
    skill_performance: str | None = None
    scenario_performance: str | None = None
    scenario_stats: str | None = None
    simulation_performance: str | None = None
    simulation_composition: str | None = None


class Thresholds(BaseModel):
    """Performance thresholds for analytics metrics."""

    danger: int
    warning: int
    success: int


class DashboardBundleResponse(BaseModel):
    """Complete dashboard bundle with all metrics, history, insights, and mappings."""

    header: DashboardHeaderMetrics
    primary: DashboardPrimaryMetrics
    secondary: DashboardSecondaryMetrics
    footer: DashboardFooterMetrics
    history: AttemptHistoryResponse
    insights: DashboardInsights
    thresholds: Thresholds

    # Normalized entity mappings (from base.py)
    simulation_mapping: SimulationMapping
    rubric_mapping: RubricMapping
    parameter_mapping: ParameterMapping
    parameter_item_mapping: ParameterItemMapping


@router.post("/", response_model=DashboardBundleResponse)
async def get_dashboard(
    filters: AnalyticsFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DashboardBundleResponse:
    """Get complete dashboard bundle with all metrics, history, insights, and mappings."""
    try:
        sql = load_sql("sql/v3/dashboard/get_dashboard_bundle.sql")

        # Build parameters in the same order as the query expects ($1-$7)
        start_dt = datetime.fromisoformat(filters.startDate.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(filters.endDate.replace("Z", "+00:00"))
        cohort_ids = filters.cohortIds or []
        roles = filters.roles or []
        sim_filters = (
            [f.value if isinstance(f, SimulationFilter) else f for f in filters.simulationFilters]
            if filters.simulationFilters
            else ["general"]
        )
        profile_id = filters.profileId
        department_ids = filters.departmentIds or []

        params = [start_dt, end_dt, cohort_ids, roles, sim_filters, profile_id, department_ids]

        # Execute query
        result = await conn.fetchval(sql, *params)

        if not result:
            raise ValueError("Dashboard bundle query returned no results")

        # Parse JSONB result (may be string or dict)
        data = result
        if isinstance(data, str):
            data = json.loads(data)

        # Validate and return response
        return DashboardBundleResponse.model_validate(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
