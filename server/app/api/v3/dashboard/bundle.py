"""Dashboard bundle v3 API endpoint."""

import json
from datetime import datetime
from typing import Annotated, Any, Literal

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import (AttemptHistoryRow, DataPoint, Method,
                              MetricResponse, ParameterItemMapping,
                              ParameterItemMappingItem, ParameterMapping,
                              ParameterMappingItem, RubricMapping,
                              RubricMappingItem, SimulationFilter,
                              SimulationMapping, SimulationMappingItem,
                              TrendData)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

router = APIRouter()


# Inline filter schemas
class DashboardBundleFilters(BaseModel):
    """Dashboard bundle filter request schema."""

    startDate: str
    endDate: str
    cohortIds: list[str] | None = None
    roles: list[str] | None = None
    simulationFilters: list[SimulationFilter] | None = None
    departmentIds: list[str] | None = None

    @field_validator("departmentIds", mode="before")
    @classmethod
    def convert_department_id(cls, v: Any) -> list[str] | None:  # noqa: ANN401
        """Convert single department_id string to list, or return None."""
        if v is None:
            return None
        if isinstance(v, str):
            return [v] if v else None
        if isinstance(v, list):
            return v
        return [str(v)] if v else None


# AttemptHistoryRow is imported from app.utils.schema


AttemptHistoryResponse = list[AttemptHistoryRow]


# Inline schemas
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

    model_config = ConfigDict(populate_by_name=True)

    attempt: str
    average_score: float = 0
    average_time: float = 0
    pass_rate: float = 0


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

    model_config = ConfigDict(populate_by_name=True)

    average_score: MetricResponse = Field(
        alias="averageScore", serialization_alias="averageScore"
    )
    completion_percentage: MetricResponse = Field(
        alias="completionPercentage", serialization_alias="completionPercentage"
    )
    first_attempt_pass_rate: MetricResponse = Field(
        alias="firstAttemptPassRate", serialization_alias="firstAttemptPassRate"
    )
    highest_score: MetricResponse = Field(
        alias="highestScore", serialization_alias="highestScore"
    )
    messages_per_session: MetricResponse = Field(
        alias="messagesPerSession", serialization_alias="messagesPerSession"
    )
    persona_response_times: MetricResponse = Field(
        alias="personaResponseTimes", serialization_alias="personaResponseTimes"
    )
    session_efficiency: MetricResponse = Field(
        alias="sessionEfficiency", serialization_alias="sessionEfficiency"
    )
    stagnation_rate: MetricResponse = Field(
        alias="stagnationRate", serialization_alias="stagnationRate"
    )
    time_spent: MetricResponse = Field(
        alias="timeSpent", serialization_alias="timeSpent"
    )
    total_attempts: MetricResponse = Field(
        alias="totalAttempts", serialization_alias="totalAttempts"
    )


class DashboardPrimaryMetrics(BaseModel):
    """Primary metrics (3 total)."""

    model_config = ConfigDict(populate_by_name=True)

    growth_data: GrowthDataResponse = Field(
        alias="growthData", serialization_alias="growthData"
    )
    persona_performance: PersonaPerformanceResponse = Field(
        alias="personaPerformance", serialization_alias="personaPerformance"
    )
    rubric_heatmap: RubricHeatmapResponse = Field(
        alias="rubricHeatmap", serialization_alias="rubricHeatmap"
    )


class DashboardSecondaryMetrics(BaseModel):
    """Secondary metrics (3 total)."""

    model_config = ConfigDict(populate_by_name=True)

    attempt_improvement: AttemptImprovementResponse = Field(
        alias="attemptImprovement", serialization_alias="attemptImprovement"
    )
    cohort_performance: CohortPerformanceResponse = Field(
        alias="cohortPerformance", serialization_alias="cohortPerformance"
    )
    skill_performance: SkillPerformanceResponse = Field(
        alias="skillPerformance", serialization_alias="skillPerformance"
    )


class DashboardFooterMetrics(BaseModel):
    """Footer metrics (4 total)."""

    model_config = ConfigDict(populate_by_name=True)

    scenario_performance: ScenarioPerformanceResponse = Field(
        alias="scenarioPerformance", serialization_alias="scenarioPerformance"
    )
    scenario_stats: ScenarioStatsResponse = Field(
        alias="scenarioStats", serialization_alias="scenarioStats"
    )
    simulation_performance: SimulationPerformanceResponse = Field(
        alias="simulationPerformance", serialization_alias="simulationPerformance"
    )
    simulation_composition: SimulationCompositionResponse = Field(
        alias="simulationComposition", serialization_alias="simulationComposition"
    )


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


# ==============================================================
# PARSING HELPER FUNCTIONS (from DashboardService)
# ==============================================================


def _parse_metric(metric_data: dict[str, Any]) -> MetricResponse:
    """Parse a metric response from JSON data."""
    # Parse trendData
    trend_data_raw = metric_data.get("trendData", [])
    trend_data: list[TrendData] = []
    if isinstance(trend_data_raw, list):
        for td in trend_data_raw:
            if isinstance(td, dict):
                trend_data.append(
                    TrendData(
                        date=td.get("date", ""),
                        value=td.get("value", 0.0),
                        count=td.get("count", 0),
                    )
                )

    # Parse dataPoints
    data_points_raw = metric_data.get("dataPoints", [])
    data_points: list[DataPoint] = []
    if isinstance(data_points_raw, list):
        for dp in data_points_raw:
            if isinstance(dp, dict):
                # Handle NULL profileId - convert to empty string if None
                profile_id = dp.get("profileId")
                if profile_id is None:
                    profile_id = ""

                data_points.append(
                    DataPoint(
                        profileId=profile_id,
                        date=dp.get("date"),
                        value=dp.get("value"),
                        attemptId=dp.get("attemptId"),
                        simulationId=dp.get("simulationId"),
                        scenarioId=dp.get("scenarioId"),
                        count=dp.get("count"),
                    )
                )

    return MetricResponse(
        hasData=metric_data.get("hasData", False),
        method=Method(metric_data.get("method", "avg")),
        currentValue=metric_data.get("currentValue", 0),
        trendAnalysis=metric_data.get("trendAnalysis"),
        valueField=metric_data.get("valueField"),
        keyField=metric_data.get("keyField"),
        trendData=trend_data,
        dataPoints=data_points,
    )


def _parse_window_average(avg_data: dict[str, Any]) -> GrowthWindowAverage:
    """Parse window average from JSON data."""
    return GrowthWindowAverage(
        n=avg_data.get("n", 7),
        last=avg_data.get("last"),
        prev=avg_data.get("prev"),
    )


# ==============================================================
# INSIGHT COMPUTATION FUNCTIONS (from DashboardService)
# ==============================================================


def _compute_growth_insight(window_averages: GrowthWindowAverages) -> str | None:
    """Compute actionable insight for growth data."""
    current = window_averages.averageScore.last
    previous = window_averages.averageScore.prev

    if current is None:
        return None

    if previous is not None:
        improvement = current - previous

        if improvement < -5:
            return f"Performance declined {abs(improvement):.1f}% - review challenging areas."
        if improvement > 5:
            return f"Scores improved {improvement:.1f}% - consider advanced challenges."
        if improvement > 2:
            return (
                f"Steady improvement of {improvement:.1f}% - continue current approach."
            )
        if improvement < -2:
            return f"Slight decline of {abs(improvement):.1f}% - adjust study strategy."

    return None


def _compute_persona_insight(
    trend_data: list[PersonaTrendData],
    persona_name: str,
    current_score: float,
) -> str | None:
    """Compute actionable insight for a persona."""
    if len(trend_data) < 2:
        return None

    recent_scores = trend_data[-3:]
    earlier_scores = trend_data[:3]

    if len(recent_scores) == 0 or len(earlier_scores) == 0:
        return None

    recent_avg = sum(item.score or 0 for item in recent_scores) / len(recent_scores)
    earlier_avg = sum(item.score or 0 for item in earlier_scores) / len(earlier_scores)
    improvement = recent_avg - earlier_avg

    if improvement > 5:
        return f"Performance improved {round(improvement)}% recently - consider advancing to more challenging scenarios."
    elif improvement < -5:
        return f"Performance declined {round(abs(improvement))}% recently - review training approach."
    elif current_score >= 90:
        return f"Excellent performance at {round(current_score)}% - maintain high standards."
    elif current_score < 60:
        return f"Performance at {round(current_score)}% needs attention - review fundamentals."

    return None


def _compute_rubric_heatmap_insight(matrices: list[RubricMatrixPackage]) -> str | None:
    """Compute actionable insight from rubric heatmap data."""
    if len(matrices) == 0:
        return None

    matrix = matrices[0]
    if not matrix or not matrix.hasData:
        return None

    strongest_positive_corr = 0.0
    strongest_positive_pair = ""
    strongest_negative_corr = 0.0
    strongest_negative_pair = ""

    for i, row in enumerate(matrix.matrix):
        for j, cell in enumerate(row):
            if i != j and cell and cell.dataPoints > 0:
                correlation = cell.correlation
                row_group = (
                    matrix.standardGroups[i] if i < len(matrix.standardGroups) else None
                )
                col_group = (
                    matrix.standardGroups[j] if j < len(matrix.standardGroups) else None
                )

                if row_group and col_group:
                    pair = f"{row_group.shortName} ↔ {col_group.shortName}"

                    if correlation > strongest_positive_corr:
                        strongest_positive_corr = correlation
                        strongest_positive_pair = pair
                    if correlation < strongest_negative_corr:
                        strongest_negative_corr = correlation
                        strongest_negative_pair = pair

    if strongest_positive_corr > 0.7:
        return f"Strong positive correlation: {strongest_positive_pair} ({strongest_positive_corr:.2f}). Skills develop together."
    elif strongest_negative_corr < -0.5:
        return f"Negative correlation: {strongest_negative_pair} ({strongest_negative_corr:.2f}). May indicate trade-offs."

    return None


def _compute_attempt_improvement_insight(
    chart_data: list[AttemptImprovementData],
) -> str | None:
    """Compute actionable insight from attempt improvement data."""
    if len(chart_data) < 2:
        return None

    first_attempt = chart_data[0]
    last_attempt = chart_data[-1]

    if not first_attempt or not last_attempt:
        return None

    score_improvement = last_attempt.average_score - first_attempt.average_score

    if score_improvement > 5:
        return f"Users improve by {score_improvement}% on average between attempts. Consider advancing to more challenging scenarios."
    elif score_improvement < -5:
        return f"Performance declined by {abs(score_improvement)}% between attempts. Review training approach."

    return None


def _compute_cohort_insights(cohort_data: list[CohortData]) -> dict[str, str | None]:
    """Compute actionable insights for cohorts."""
    insights: dict[str, str | None] = {}

    if len(cohort_data) == 0:
        return insights

    sorted_cohorts = sorted(cohort_data, key=lambda c: c.passRate, reverse=True)
    avg_pass_rate = sum(cohort.passRate for cohort in cohort_data) / len(cohort_data)
    high_performers = [c for c in cohort_data if c.passRate >= 90]
    all_high_performers = len(high_performers) == len(cohort_data)

    for cohort in cohort_data:
        rank = next(
            (i + 1 for i, c in enumerate(sorted_cohorts) if c.id == cohort.id), 0
        )
        pass_rate_diff = cohort.passRate - avg_pass_rate

        if cohort.passRate >= 95:
            if all_high_performers:
                insights[cohort.id] = (
                    f"Outstanding performance at {round(cohort.passRate)}% - maintain excellence and mentor others."
                )
            else:
                insights[cohort.id] = (
                    f"Leading performance at {round(cohort.passRate)}% (rank {rank}) - share successful strategies with other cohorts."
                )
        elif cohort.passRate >= 80:
            if pass_rate_diff > 5:
                insights[cohort.id] = (
                    f"Strong performance at {round(cohort.passRate)}% - {abs(round(pass_rate_diff))}% above average."
                )
            elif pass_rate_diff < -5:
                insights[cohort.id] = (
                    f"Good performance at {round(cohort.passRate)}% but {abs(round(pass_rate_diff))}% below average - opportunities for improvement."
                )
        elif cohort.passRate >= 60:
            insights[cohort.id] = (
                f"Moderate performance at {round(cohort.passRate)}% - focus on fundamentals to improve outcomes."
            )
        elif cohort.passRate < 60:
            insights[cohort.id] = (
                f"Performance at {round(cohort.passRate)}% needs attention - review training materials and provide additional support."
            )

    return insights


def _compute_skill_performance_insight(radar_data: list[SkillRadarData]) -> str | None:
    """Compute actionable insight from skill performance radar data."""
    if len(radar_data) == 0:
        return None

    values = [skill.value for skill in radar_data]
    avg_proficiency = sum(values) / len(values)
    min_proficiency = min(values)
    max_proficiency = max(values)
    skill_gap = max_proficiency - min_proficiency

    weak_skills = [skill for skill in radar_data if skill.value < 0.5]
    strong_skills = [skill for skill in radar_data if skill.value >= 0.8]
    moderate_skills = [
        skill
        for skill in radar_data
        if skill.value >= 0.5 and skill.value < 0.8
    ]

    # Large skill gap - prioritize weakest area
    if skill_gap > 0.4:
        weakest_skill = min(radar_data, key=lambda s: s.value)
        return f"Large skill gap detected ({round(skill_gap * 100)}%) - focus on {weakest_skill.metric} ({round(weakest_skill.value * 100)}%) to balance skillset."

    # Multiple weak areas
    if len(weak_skills) > 1:
        weak_names = ", ".join([s.metric for s in weak_skills])
        return f"Multiple areas need attention: {weak_names}. Focus on fundamentals to build a strong foundation."

    # Single weak skill
    if len(weak_skills) == 1:
        return f"Focus on improving {weak_skills[0].metric} ({round(weak_skills[0].value * 100)}%) to balance skillset."

    # All skills are strong
    if len(strong_skills) == len(radar_data):
        return f"Excellent proficiency across all skills (avg {round(avg_proficiency * 100)}%) - maintain consistency and consider advanced challenges."

    # Moderate performance - provide balanced insight
    if len(moderate_skills) > 0 and avg_proficiency >= 0.6:
        return f"Balanced performance across skills (avg {round(avg_proficiency * 100)}%). Continue building proficiency in all areas."

    # General insight for other cases
    if avg_proficiency >= 0.7:
        return f"Strong overall performance (avg {round(avg_proficiency * 100)}%) with {len(strong_skills)} skill(s) exceeding 80% proficiency."
    elif avg_proficiency >= 0.5:
        return f"Moderate performance (avg {round(avg_proficiency * 100)}%) - focus on consistent practice to improve across all competencies."
    else:
        return f"Performance below target (avg {round(avg_proficiency * 100)}%) - review fundamentals and provide additional support."


def _compute_scenario_performance_insight(
    attribute_attempt_facts: list[ScenarioAttributeAttemptFact],
) -> str | None:
    """Compute actionable insight from scenario performance data."""
    if len(attribute_attempt_facts) == 0:
        return None

    by_parameter_item: dict[str, dict[str, float]] = {}

    for fact in attribute_attempt_facts:
        key = fact.parameterItemId
        if key not in by_parameter_item:
            by_parameter_item[key] = {"totalScore": 0.0, "totalAttempts": 0.0}

        by_parameter_item[key]["totalScore"] += fact.avgScore * fact.attempts
        by_parameter_item[key]["totalAttempts"] += fact.attempts

    avg_scores = {
        key: data["totalScore"] / data["totalAttempts"]
        if data["totalAttempts"] > 0
        else 0
        for key, data in by_parameter_item.items()
    }

    if len(avg_scores) == 0:
        return None

    best_param_item = max(avg_scores.items(), key=lambda x: x[1])
    worst_param_item = min(avg_scores.items(), key=lambda x: x[1])
    performance_gap = best_param_item[1] - worst_param_item[1]
    overall_avg = sum(avg_scores.values()) / len(avg_scores)

    # Significant performance variation
    if performance_gap > 20:
        return f"Performance varies significantly by scenario attributes ({performance_gap:.0f}% gap between best and worst). Review challenging scenarios to identify improvement opportunities."

    # Moderate variation
    elif performance_gap > 10:
        return f"Moderate performance variation ({performance_gap:.0f}% gap) across scenario attributes. Consider targeted support for lower-performing scenarios."

    # Consistent performance - provide positive insight
    elif overall_avg >= 75:
        return f"Consistent strong performance (avg {overall_avg:.0f}%) across scenario attributes. Performance is well-balanced."

    elif overall_avg >= 60:
        return f"Consistent moderate performance (avg {overall_avg:.0f}%) across scenario attributes. Continue building proficiency."

    else:
        return f"Performance below target (avg {overall_avg:.0f}%) across scenario attributes. Review training materials and provide additional support."


def _compute_scenario_stats_insight(
    numeric_attempt_facts: list[NumericAttemptFact],
) -> str | None:
    """Compute actionable insight from scenario stats data."""
    if len(numeric_attempt_facts) == 0:
        return None

    total_correlation = 0.0
    correlation_count = 0
    total_score = 0.0
    total_attempts = 0

    by_parameter: dict[str, list[NumericAttemptFact]] = {}
    for fact in numeric_attempt_facts:
        if fact.parameterId not in by_parameter:
            by_parameter[fact.parameterId] = []
        by_parameter[fact.parameterId].append(fact)
        total_score += fact.score * fact.attempts
        total_attempts += fact.attempts

    for facts in by_parameter.values():
        if len(facts) < 2:
            continue

        n = len(facts)
        sum_x = sum(f.levelValue for f in facts)
        sum_y = sum(f.score for f in facts)
        sum_xy = sum(f.levelValue * f.score for f in facts)
        sum_xx = sum(f.levelValue * f.levelValue for f in facts)
        sum_yy = sum(f.score * f.score for f in facts)

        denominator = (
            (n * sum_xx - sum_x * sum_x) * (n * sum_yy - sum_y * sum_y)
        ) ** 0.5
        if denominator > 0:
            correlation = (n * sum_xy - sum_x * sum_y) / denominator
            total_correlation += correlation
            correlation_count += 1

    overall_avg_score = (
        total_score / total_attempts if total_attempts > 0 else 0.0
    )

    if correlation_count > 0:
        avg_correlation = total_correlation / correlation_count

        # Strong positive correlation
        if avg_correlation > 0.5:
            return f"Strong positive correlation (r={avg_correlation:.2f}) - higher parameter levels correlate with better performance (avg {overall_avg_score:.0f}%). Consider increasing challenge levels."

        # Moderate positive correlation
        elif avg_correlation > 0.2:
            return f"Moderate positive correlation (r={avg_correlation:.2f}) - performance tends to improve with higher parameter levels. Monitor progression carefully."

        # Strong negative correlation
        elif avg_correlation < -0.5:
            return f"Strong negative correlation (r={avg_correlation:.2f}) - performance decreases at higher parameter levels (avg {overall_avg_score:.0f}%). Review training progression and difficulty scaling."

        # Moderate negative correlation
        elif avg_correlation < -0.2:
            return f"Moderate negative correlation (r={avg_correlation:.2f}) - performance may decline with higher parameter levels. Consider adjusting difficulty curve."

        # Weak correlation - provide general insight based on performance
        else:
            if overall_avg_score >= 75:
                return f"Weak correlation (r={avg_correlation:.2f}) between parameter levels and performance. Strong overall performance (avg {overall_avg_score:.0f}%) suggests consistent quality across difficulty levels."
            elif overall_avg_score >= 60:
                return f"Weak correlation (r={avg_correlation:.2f}) between parameter levels and performance. Moderate overall performance (avg {overall_avg_score:.0f}%) - focus on consistent improvement."
            else:
                return f"Weak correlation (r={avg_correlation:.2f}) between parameter levels and performance. Below target performance (avg {overall_avg_score:.0f}%) - review training materials and support."

    # No correlation computed (insufficient data points) - provide insight based on overall performance
    if overall_avg_score >= 75:
        return f"Strong overall performance (avg {overall_avg_score:.0f}%) across scenario characteristics. Performance is consistent regardless of parameter levels."
    elif overall_avg_score >= 60:
        return f"Moderate overall performance (avg {overall_avg_score:.0f}%) across scenario characteristics. Continue building proficiency across all difficulty levels."
    else:
        return f"Performance below target (avg {overall_avg_score:.0f}%) across scenario characteristics. Review training materials and provide additional support."


def _compute_simulation_performance_insight(
    scenario_facts: list[ScenarioFact],
) -> str | None:
    """Compute actionable insight from simulation performance data."""
    if len(scenario_facts) == 0:
        return None

    sorted_by_score = sorted(scenario_facts, key=lambda s: s.avgScore, reverse=True)
    best = sorted_by_score[0] if sorted_by_score else None
    worst = sorted_by_score[-1] if sorted_by_score else None

    if best and worst and best.avgScore > worst.avgScore:
        score_diff = best.avgScore - worst.avgScore
        if score_diff > 20:
            return f"Performance gap of {round(score_diff)}% between best ({best.scenarioName}) and worst ({worst.scenarioName}) scenarios. Consider rebalancing difficulty."

    low_success = [s for s in scenario_facts if s.successRate < 50]
    if len(low_success) > 0:
        return f"{len(low_success)} scenario(s) have success rates below 50%. Review these scenarios for potential improvements."

    return None


def _compute_simulation_composition_insight(
    simulation_facts: list[SimulationFact],
) -> str | None:
    """Compute actionable insight from simulation composition data."""
    if not simulation_facts or len(simulation_facts) == 0:
        return None

    avg_score = sum(sim.avgScore for sim in simulation_facts) / len(simulation_facts)
    avg_completion = sum(sim.completionRate for sim in simulation_facts) / len(
        simulation_facts
    )

    sorted_by_score = sorted(simulation_facts, key=lambda s: s.avgScore, reverse=True)
    top_performer = sorted_by_score[0] if sorted_by_score else None
    bottom_performer = sorted_by_score[-1] if sorted_by_score else None

    if top_performer and bottom_performer:
        performance_gap = top_performer.avgScore - bottom_performer.avgScore

        if performance_gap > 30:
            return (
                f"Significant performance gap ({performance_gap:.0f}%) between "
                f'top performer "{top_performer.title}" ({top_performer.avgScore}%) '
                f'and bottom performer "{bottom_performer.title}" ({bottom_performer.avgScore}%). '
                "Consider analyzing composition differences."
            )

    if avg_completion < 60:
        return f"Average completion rate is {avg_completion:.0f}%. Consider reviewing simulation length and difficulty."

    if avg_score < 60:
        return f"Average score is {avg_score:.0f}%. Review simulation difficulty and training materials."

    return None


def _parse_dashboard_bundle(data: dict[str, Any]) -> DashboardBundleResponse:
    """Parse dashboard bundle from SQL result (same logic as v2 DashboardService)."""
    # Parse header metrics
    header_data = data.get("header", {})
    header = DashboardHeaderMetrics(
        averageScore=_parse_metric(header_data.get("averageScore", {})),
        completionPercentage=_parse_metric(header_data.get("completionPercentage", {})),
        firstAttemptPassRate=_parse_metric(header_data.get("firstAttemptPassRate", {})),
        highestScore=_parse_metric(header_data.get("highestScore", {})),
        messagesPerSession=_parse_metric(header_data.get("messagesPerSession", {})),
        personaResponseTimes=_parse_metric(header_data.get("personaResponseTimes", {})),
        sessionEfficiency=_parse_metric(header_data.get("sessionEfficiency", {})),
        stagnationRate=_parse_metric(header_data.get("stagnationRate", {})),
        timeSpent=_parse_metric(header_data.get("timeSpent", {})),
        totalAttempts=_parse_metric(header_data.get("totalAttempts", {})),
    )

    # Parse primary metrics
    primary_data = data.get("primary", {})

    # Growth data
    growth_data_raw = primary_data.get("growthData", {})
    growth_data = GrowthDataResponse(
        chartData=growth_data_raw.get("chartData", []),
        availableMetrics=growth_data_raw.get("availableMetrics", []),
        windowAverages=GrowthWindowAverages(
            averageScore=_parse_window_average(
                growth_data_raw.get("windowAverages", {}).get("averageScore", {})
            )
        ),
    )

    # Persona performance
    persona_perf_raw = primary_data.get("personaPerformance", {})
    persona_chart_data = []
    for p_data in persona_perf_raw.get("chartData", []):
        persona_chart_data.append(
            PersonaPerformanceData(
                name=p_data.get("name", ""),
                score=p_data.get("score", 0),
                sessions=p_data.get("sessions", 0),
                color=p_data.get("color", "#3b82f6"),
                simulationIds=p_data.get("simulationIds", []),
                trendData=[
                    PersonaTrendData(
                        date=td.get("date", ""),
                        score=td.get("score"),
                        timestamp=td.get("timestamp", 0),
                        simulationId=td.get("simulationId"),
                    )
                    for td in p_data.get("trendData", [])
                ],
            )
        )
    persona_performance = PersonaPerformanceResponse(
        chartData=persona_chart_data,
        validSimulationIds=persona_perf_raw.get("validSimulationIds", []),
        personaColors=persona_perf_raw.get("personaColors", {}),
    )

    # Rubric heatmap
    rubric_heatmap_raw = primary_data.get("rubricHeatmap", {})
    rubric_matrices = []
    for matrix_data in rubric_heatmap_raw.get("matrices", []):
        rubric_matrices.append(
            RubricMatrixPackage(
                rubricId=matrix_data.get("rubricId", ""),
                standardGroups=matrix_data.get("standardGroups", []),
                matrix=matrix_data.get("matrix", []),
                insights=matrix_data.get("insights"),
                hasData=matrix_data.get("hasData", False),
            )
        )
    rubric_heatmap = RubricHeatmapResponse(
        matrices=rubric_matrices,
        validRubricIds=rubric_heatmap_raw.get("validRubricIds", []),
    )

    primary = DashboardPrimaryMetrics(
        growthData=growth_data,
        personaPerformance=persona_performance,
        rubricHeatmap=rubric_heatmap,
    )

    # Parse secondary metrics
    secondary_data = data.get("secondary", {})

    # Attempt improvement
    attempt_imp_raw = secondary_data.get("attemptImprovement", {})
    attempt_improvement = AttemptImprovementResponse(
        chartData=[
            AttemptImprovementData(
                attempt=item.get("attempt", ""),
                average_score=item.get("average_score", 0),
                average_time=item.get("average_time", 0),
                pass_rate=item.get("pass_rate", 0),
            )
            for item in attempt_imp_raw.get("chartData", [])
        ],
        facts=attempt_imp_raw.get("facts", []),
        validSimulationIds=attempt_imp_raw.get("validSimulationIds", []),
    )

    # Cohort performance
    cohort_perf_raw = secondary_data.get("cohortPerformance", {})
    cohort_data = []
    for c_data in cohort_perf_raw.get("cohortData", []):
        cohort_data.append(
            CohortData(
                id=c_data.get("id", ""),
                name=c_data.get("name", ""),
                passRate=c_data.get("passRate", 0.0),
                avgPercentageScore=c_data.get("avgPercentageScore", 0),
                totalStudents=c_data.get("totalStudents", 0),
                passedStudents=c_data.get("passedStudents", 0),
                totalAttempts=c_data.get("totalAttempts", 0),
                passedAttempts=c_data.get("passedAttempts", 0),
                simulationCount=c_data.get("simulationCount", 0),
                requiredSimulations=c_data.get("requiredSimulations", 0),
            )
        )
    cohort_performance = CohortPerformanceResponse(
        cohortData=cohort_data,
        dailyData=cohort_perf_raw.get("dailyData", []),
        cohortFacts=cohort_perf_raw.get("cohortFacts", []),
        dailyFacts=cohort_perf_raw.get("dailyFacts", []),
        validSimulationIds=cohort_perf_raw.get("validSimulationIds", []),
    )

    # Skill performance
    skill_perf_raw = secondary_data.get("skillPerformance", {})
    skill_packages = []
    for pkg_data in skill_perf_raw.get("packages", []):
        radar_data = []
        for rd in pkg_data.get("radarData", []):
            radar_data.append(
                SkillRadarData(
                    metric=rd.get("metric", ""),
                    description=rd.get("description", ""),
                    value=rd.get("value", 0.0),
                    fullMark=rd.get("fullMark", 1.0),
                )
            )
        group_facts = []
        for gf in pkg_data.get("groupFacts", []):
            group_facts.append(
                SkillStandardFact(
                    groupId=gf.get("groupId", ""),
                    groupName=gf.get("groupName", ""),
                    groupDescription=gf.get("groupDescription"),
                    simulationId=gf.get("simulationId", ""),
                    score=gf.get("score", 0.0),
                    points=gf.get("points", 0.0),
                    avgPct=gf.get("avgPct", 0.0),
                )
            )
        skill_packages.append(
            SkillPackage(
                rubricId=pkg_data.get("rubricId", ""),
                radarData=radar_data,
                groupFacts=group_facts,
            )
        )
    skill_performance = SkillPerformanceResponse(
        packages=skill_packages,
        validRubricIds=skill_perf_raw.get("validRubricIds", []),
    )

    secondary = DashboardSecondaryMetrics(
        attemptImprovement=attempt_improvement,
        cohortPerformance=cohort_performance,
        skillPerformance=skill_performance,
    )

    # Parse footer metrics
    footer_data = data.get("footer", {})

    # Scenario performance
    scenario_perf_raw = footer_data.get("scenarioPerformance", {})
    attr_attempt_facts = []
    for fact in scenario_perf_raw.get("attributeAttemptFacts", []):
        attr_attempt_facts.append(
            ScenarioAttributeAttemptFact(
                parameterId=fact.get("parameterId", ""),
                parameterItemId=fact.get("parameterItemId", ""),
                date=fact.get("date", ""),
                timestamp=fact.get("timestamp", 0),
                avgScore=fact.get("avgScore", 0),
                attempts=fact.get("attempts", 0),
                passedAttempts=fact.get("passedAttempts", 0),
            )
        )
    scenario_performance = ScenarioPerformanceResponse(
        validParameterIds=scenario_perf_raw.get("validParameterIds", []),
        attributeAttemptFacts=attr_attempt_facts,
        attributeScenarioFacts=scenario_perf_raw.get("attributeScenarioFacts", []),
    )

    # Scenario stats
    scenario_stats_raw = footer_data.get("scenarioStats", {})
    numeric_attempt_facts = []
    for fact in scenario_stats_raw.get("numericAttemptFacts", []):
        numeric_attempt_facts.append(
            NumericAttemptFact(
                parameterId=fact.get("parameterId", ""),
                levelLabel=fact.get("levelLabel", ""),
                levelValue=fact.get("levelValue", 0.0),
                score=fact.get("score", 0),
                attempts=fact.get("attempts", 0),
            )
        )
    scenario_stats = ScenarioStatsResponse(
        validNumericParameterIds=scenario_stats_raw.get("validNumericParameterIds", []),
        numericAttemptFacts=numeric_attempt_facts,
        numericScenarioFacts=scenario_stats_raw.get("numericScenarioFacts", []),
    )

    # Simulation performance
    sim_perf_raw = footer_data.get("simulationPerformance", {})
    simulation_performance = SimulationPerformanceResponse(
        validSimulationIds=sim_perf_raw.get("validSimulationIds", []),
        scenarioFacts=[
            ScenarioFact(
                simulationId=sf.get("simulationId", ""),
                scenarioId=sf.get("scenarioId", ""),
                scenarioName=sf.get("scenarioName", ""),
                avgScore=sf.get("avgScore", 0),
                successRate=sf.get("successRate", 0),
                totalAttempts=sf.get("totalAttempts", 0),
                completedAttempts=sf.get("completedAttempts", 0),
            )
            for sf in sim_perf_raw.get("scenarioFacts", [])
        ],
    )

    # Simulation composition
    sim_comp_raw = footer_data.get("simulationComposition", {})
    simulation_composition = SimulationCompositionResponse(
        validSimulationIds=sim_comp_raw.get("validSimulationIds", []),
        simulationFacts=[
            SimulationFact(
                simulationId=sf.get("simulationId", ""),
                title=sf.get("title", ""),
                avgScore=sf.get("avgScore", 0),
                completionRate=sf.get("completionRate", 0),
                totalAttempts=sf.get("totalAttempts", 0),
                scenarioCount=sf.get("scenarioCount", 0),
            )
            for sf in sim_comp_raw.get("simulationFacts", [])
        ],
        simulationParameterFactsCategorical=sim_comp_raw.get(
            "simulationParameterFactsCategorical", []
        ),
        simulationParameterFactsNumeric=sim_comp_raw.get(
            "simulationParameterFactsNumeric", []
        ),
        hasData=sim_comp_raw.get("hasData", False),
    )

    footer = DashboardFooterMetrics(
        scenarioPerformance=scenario_performance,
        scenarioStats=scenario_stats,
        simulationPerformance=simulation_performance,
        simulationComposition=simulation_composition,
    )

    # Parse history
    history = data.get("history", [])

    # Parse mappings
    simulation_mapping_raw = data.get("simulationMapping", {})
    simulation_mapping: SimulationMapping = {}
    for sim_id, sim_data in simulation_mapping_raw.items():
        # Handle department_ids - may be array or null
        dept_ids = sim_data.get("department_ids")
        if isinstance(dept_ids, str):
            try:
                dept_ids = json.loads(dept_ids)
            except (json.JSONDecodeError, ValueError):
                dept_ids = [dept_ids] if dept_ids else None
        elif dept_ids is None:
            dept_ids = None
        elif not isinstance(dept_ids, list):
            dept_ids = [dept_ids] if dept_ids else None

        simulation_mapping[sim_id] = SimulationMappingItem(
            name=sim_data.get("name", ""),
            description=sim_data.get("description", ""),
            time_limit=sim_data.get("time_limit"),
            department_ids=dept_ids,
        )

    rubric_mapping_raw = data.get("rubricMapping", {})
    rubric_mapping: RubricMapping = {}
    for rub_id, rub_data in rubric_mapping_raw.items():
        rubric_mapping[rub_id] = RubricMappingItem(
            name=rub_data.get("name", ""),
            description=rub_data.get("description", ""),
        )

    parameter_mapping_raw = data.get("parameterMapping", {})
    parameter_mapping: ParameterMapping = {}
    for param_id, param_data in parameter_mapping_raw.items():
        parameter_mapping[param_id] = ParameterMappingItem(
            name=param_data.get("name", ""),
            description=param_data.get("description", ""),
            numerical=param_data.get("numerical", False),
            document_parameter=param_data.get("document_parameter", False),
        )

    parameter_item_mapping_raw = data.get("parameterItemMapping", {})
    parameter_item_mapping: ParameterItemMapping = {}
    for pi_id, pi_data in parameter_item_mapping_raw.items():
        parameter_item_mapping[pi_id] = ParameterItemMappingItem(
            name=pi_data.get("name", ""),
            description=pi_data.get("description", ""),
            parameter_id=pi_data.get("parameterId", ""),
            parameter_name=pi_data.get("parameterName", ""),
            value=pi_data.get("value", ""),
        )

    # Compute all actionable insights
    insights = DashboardInsights(
        growth=_compute_growth_insight(growth_data.windowAverages),
        persona={
            persona_data.name: _compute_persona_insight(
                persona_data.trendData, persona_data.name, persona_data.score
            )
            for persona_data in persona_performance.chartData
        },
        rubric_heatmap=_compute_rubric_heatmap_insight(rubric_heatmap.matrices),
        attempt_improvement=_compute_attempt_improvement_insight(
            attempt_improvement.chartData
        ),
        cohort=dict(_compute_cohort_insights(
                cohort_performance.cohortData
            ).items()),
        skill_performance=_compute_skill_performance_insight(
            skill_performance.packages[0].radarData
            if skill_performance.packages
            else []
        ),
        scenario_performance=_compute_scenario_performance_insight(
            scenario_performance.attributeAttemptFacts
        ),
        scenario_stats=_compute_scenario_stats_insight(
            scenario_stats.numericAttemptFacts
        ),
        simulation_performance=_compute_simulation_performance_insight(
            simulation_performance.scenarioFacts
        ),
        simulation_composition=_compute_simulation_composition_insight(
            simulation_composition.simulationFacts
        ),
    )

    # Standard thresholds for all metrics
    thresholds = Thresholds(danger=60, warning=75, success=85)

    return DashboardBundleResponse(
        header=header,
        primary=primary,
        secondary=secondary,
        footer=footer,
        history=history,
        insights=insights,
        thresholds=thresholds,
        simulation_mapping=simulation_mapping,
        rubric_mapping=rubric_mapping,
        parameter_mapping=parameter_mapping,
        parameter_item_mapping=parameter_item_mapping,
    )


@router.post("/overview", response_model=DashboardBundleResponse)
async def get_dashboard(
    filters: DashboardBundleFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DashboardBundleResponse:
    """Get complete dashboard bundle with all metrics, history, insights, and mappings."""
    tags = ["dashboard"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return DashboardBundleResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/dashboard/get_dashboard_bundle.sql")

        # Build parameters in the same order as the query expects ($1-$6)
        # $1-$2: dates, $3: cohort_ids, $4: roles, $5: sim_filters, $6: department_ids
        start_dt = datetime.fromisoformat(filters.startDate.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(filters.endDate.replace("Z", "+00:00"))
        cohort_ids = filters.cohortIds or []
        roles = filters.roles or []
        sim_filters = (
            [
                f.value if isinstance(f, SimulationFilter) else f
                for f in filters.simulationFilters
            ]
            if filters.simulationFilters
            else ["general"]
        )
        department_ids = filters.departmentIds or []

        sql_params = (
            start_dt,
            end_dt,
            cohort_ids,
            roles,
            sim_filters,
            department_ids,
        )

        # Disable JIT compilation for this complex query to avoid re-compilation overhead
        # JIT compilation overhead can be significant for large JSONB aggregation queries
        # Using SET LOCAL in a transaction so it only affects this query
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            # Execute query within the same transaction
            result = await conn.fetchrow(sql_query, *sql_params)

        # Handle empty results gracefully - return empty structure instead of error
        # The SQL should always return a row, but handle edge case where it doesn't
        if not result or not result.get("result"):
            # Create empty data structure - parsing function will handle defaults
            data = {}
        else:
            # Parse JSONB result (may be string or dict)
            data = result["result"]
            if isinstance(data, str):
                data = json.loads(data)
            # Ensure data is a dict (handle case where result is None or empty)
            if not isinstance(data, dict):
                data = {}

        # Use the same parsing logic as v2 DashboardService
        # This manually parses the SQL result to match the expected response structure
        # The parsing function handles missing keys gracefully with .get() defaults
        response_data = _parse_dashboard_bundle(data)

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=300,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_dashboard",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
