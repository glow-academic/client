"""Dashboard service - single query for complete dashboard bundle."""

import json
from typing import Any

import asyncpg  # type: ignore
from app.cache import keys
from app.queries.dashboard_queries import DashboardQueries
from app.schemas.analytics import AnalyticsFilters, Method, MetricResponse
from app.schemas.base import (ParameterItemMapping, ParameterItemMappingItem,
                              ParameterMapping, ParameterMappingItem,
                              RubricMapping, RubricMappingItem,
                              SimulationMapping, SimulationMappingItem)
from app.schemas.dashboard import (AttemptImprovementData,
                                   AttemptImprovementResponse, CohortData,
                                   CohortPerformanceResponse,
                                   DashboardBundleResponse,
                                   DashboardFooterMetrics,
                                   DashboardHeaderMetrics, DashboardInsights,
                                   DashboardPrimaryMetrics,
                                   DashboardSecondaryMetrics,
                                   GrowthDataResponse, GrowthWindowAverages,
                                   NumericAttemptFact, PersonaPerformanceData,
                                   PersonaPerformanceResponse,
                                   PersonaTrendData, RubricHeatmapResponse,
                                   RubricMatrixPackage,
                                   ScenarioAttributeAttemptFact, ScenarioFact,
                                   ScenarioPerformanceResponse,
                                   ScenarioStatsResponse,
                                   SimulationCompositionResponse,
                                   SimulationFact,
                                   SimulationPerformanceResponse,
                                   SkillPerformanceResponse, SkillRadarData,
                                   Thresholds)
from app.services.base_service import BaseService, with_cache


class DashboardService(BaseService):
    """Service for dashboard analytics bundle."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = DashboardQueries()

    @with_cache(lambda self, filters: keys.analytics_dashboard_bundle(filters))
    async def get_dashboard_bundle(
        self, filters: AnalyticsFilters
    ) -> DashboardBundleResponse:
        """
        Get complete dashboard bundle with all metrics, history, insights, and mappings.

        This executes ONE complex SQL query that returns all data.
        """
        return await self._execute_get_dashboard_bundle(filters)

    async def _execute_get_dashboard_bundle(
        self, filters: AnalyticsFilters
    ) -> DashboardBundleResponse:
        """Execute the actual dashboard bundle query."""
        # Get query from query builder
        sim_filters = None
        if filters.simulationFilters:
            # Handle both enum and string values
            sim_filters = [
                f.value if hasattr(f, "value") else f
                for f in filters.simulationFilters
            ]
        
        query, params = self.queries.get_dashboard_bundle(
            filters.startDate,
            filters.endDate,
            filters.cohortIds,
            filters.roles,
            sim_filters,
            filters.profileId,
            filters.departmentIds,
        )

        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError("Dashboard bundle query returned no results")

        # Parse the JSONB result
        data = result["result"]
        if isinstance(data, str):
            data = json.loads(data)

        # Parse header metrics
        header_data = data.get("header", {})
        header = DashboardHeaderMetrics(
            average_score=self._parse_metric(header_data.get("averageScore", {})),
            completion_percentage=self._parse_metric(
                header_data.get("completionPercentage", {})
            ),
            first_attempt_pass_rate=self._parse_metric(
                header_data.get("firstAttemptPassRate", {})
            ),
            highest_score=self._parse_metric(header_data.get("highestScore", {})),
            messages_per_session=self._parse_metric(
                header_data.get("messagesPerSession", {})
            ),
            persona_response_times=self._parse_metric(
                header_data.get("personaResponseTimes", {})
            ),
            session_efficiency=self._parse_metric(
                header_data.get("sessionEfficiency", {})
            ),
            stagnation_rate=self._parse_metric(header_data.get("stagnationRate", {})),
            time_spent=self._parse_metric(header_data.get("timeSpent", {})),
            total_attempts=self._parse_metric(header_data.get("totalAttempts", {})),
        )

        # Parse primary metrics
        primary_data = data.get("primary", {})

        # Growth data
        growth_data_raw = primary_data.get("growthData", {})
        growth_data = GrowthDataResponse(
            chartData=[],
            availableMetrics=[],
            windowAverages=GrowthWindowAverages(
                averageScore=self._parse_window_average(
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
            validSimulationIds=[],
            personaColors={},
        )

        # Rubric heatmap
        rubric_heatmap_raw = primary_data.get("rubricHeatmap", {})
        rubric_heatmap = RubricHeatmapResponse(matrices=[], validRubricIds=[])

        primary = DashboardPrimaryMetrics(
            growth_data=growth_data,
            persona_performance=persona_performance,
            rubric_heatmap=rubric_heatmap,
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
            facts=[],
            validSimulationIds=[],
        )

        # Cohort performance
        cohort_perf_raw = secondary_data.get("cohortPerformance", {})
        cohort_performance = CohortPerformanceResponse(
            cohortData=[],
            dailyData=[],
            cohortFacts=[],
            dailyFacts=[],
            validSimulationIds=[],
        )

        # Skill performance
        skill_perf_raw = secondary_data.get("skillPerformance", {})
        skill_performance = SkillPerformanceResponse(packages=[], validRubricIds=[])

        secondary = DashboardSecondaryMetrics(
            attempt_improvement=attempt_improvement,
            cohort_performance=cohort_performance,
            skill_performance=skill_performance,
        )

        # Parse footer metrics
        footer_data = data.get("footer", {})

        # Scenario performance
        scenario_perf_raw = footer_data.get("scenarioPerformance", {})
        scenario_performance = ScenarioPerformanceResponse(
            validParameterIds=[],
            attributeAttemptFacts=[],
            attributeScenarioFacts=[],
        )

        # Scenario stats
        scenario_stats_raw = footer_data.get("scenarioStats", {})
        scenario_stats = ScenarioStatsResponse(
            validNumericParameterIds=[],
            numericAttemptFacts=[],
            numericScenarioFacts=[],
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
            simulationParameterFactsCategorical=[],
            simulationParameterFactsNumeric=[],
            hasData=sim_comp_raw.get("hasData", False),
        )

        footer = DashboardFooterMetrics(
            scenario_performance=scenario_performance,
            scenario_stats=scenario_stats,
            simulation_performance=simulation_performance,
            simulation_composition=simulation_composition,
        )

        # Parse history
        history = data.get("history", [])

        # Parse mappings
        simulation_mapping_raw = data.get("simulationMapping", {})
        simulation_mapping: SimulationMapping = {}
        for sim_id, sim_data in simulation_mapping_raw.items():
            simulation_mapping[sim_id] = SimulationMappingItem(
                name=sim_data.get("name", ""),
                description=sim_data.get("description", ""),
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
            )

        parameter_item_mapping_raw = data.get("parameterItemMapping", {})
        parameter_item_mapping: ParameterItemMapping = {}
        for pi_id, pi_data in parameter_item_mapping_raw.items():
            parameter_item_mapping[pi_id] = ParameterItemMappingItem(
                name=pi_data.get("name", ""),
                description=pi_data.get("description", ""),
                parameter_id=pi_data.get("parameterId", ""),
                parameter_name=pi_data.get("parameterName", ""),
            )

        # Compute all actionable insights (inlined from analytics_insights.py)
        insights = DashboardInsights(
            growth=self._compute_growth_insight(growth_data.windowAverages),
            persona={
                persona_data.name: self._compute_persona_insight(
                    persona_data.trendData, persona_data.name, persona_data.score
                )
                for persona_data in persona_performance.chartData
            },
            rubric_heatmap=self._compute_rubric_heatmap_insight(
                rubric_heatmap.matrices
            ),
            attempt_improvement=self._compute_attempt_improvement_insight(
                attempt_improvement.chartData
            ),
            cohort={
                cohort_id: insights_dict
                for cohort_id, insights_dict in self._compute_cohort_insights(
                    cohort_performance.cohortData
                ).items()
            },
            skill_performance=self._compute_skill_performance_insight(
                skill_performance.packages[0].radarData
                if skill_performance.packages
                else []
            ),
            scenario_performance=self._compute_scenario_performance_insight(
                scenario_performance.attributeAttemptFacts
            ),
            scenario_stats=self._compute_scenario_stats_insight(
                scenario_stats.numericAttemptFacts
            ),
            simulation_performance=self._compute_simulation_performance_insight(
                simulation_performance.scenarioFacts
            ),
            simulation_composition=self._compute_simulation_composition_insight(
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

    def _parse_metric(self, metric_data: dict[str, Any]) -> MetricResponse:
        """Parse a metric response from JSON data."""
        return MetricResponse(
            hasData=metric_data.get("hasData", False),
            method=Method(metric_data.get("method", "avg")),
            currentValue=metric_data.get("currentValue", 0),
            trendAnalysis=metric_data.get("trendAnalysis"),
            valueField=metric_data.get("valueField"),
            keyField=metric_data.get("keyField"),
            trendData=[],
            dataPoints=[],
        )

    def _parse_window_average(self, avg_data: dict[str, Any]) -> Any:
        """Parse window average from JSON data."""
        from app.schemas.dashboard import GrowthWindowAverage

        return GrowthWindowAverage(
            n=avg_data.get("n", 7),
            last=avg_data.get("last"),
            prev=avg_data.get("prev"),
        )

    # ==============================================================
    # INLINED INSIGHT COMPUTATION FUNCTIONS (from analytics_insights.py)
    # ==============================================================

    def _compute_growth_insight(
        self, window_averages: GrowthWindowAverages
    ) -> str | None:
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
                return f"Steady improvement of {improvement:.1f}% - continue current approach."
            if improvement < -2:
                return f"Slight decline of {abs(improvement):.1f}% - adjust study strategy."

        return None

    def _compute_persona_insight(
        self,
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
        earlier_avg = sum(item.score or 0 for item in earlier_scores) / len(
            earlier_scores
        )
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

    def _compute_rubric_heatmap_insight(
        self, matrices: list[RubricMatrixPackage]
    ) -> str | None:
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
                        matrix.standardGroups[i]
                        if i < len(matrix.standardGroups)
                        else None
                    )
                    col_group = (
                        matrix.standardGroups[j]
                        if j < len(matrix.standardGroups)
                        else None
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
        self, chart_data: list[AttemptImprovementData]
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

    def _compute_cohort_insights(
        self, cohort_data: list[CohortData]
    ) -> dict[str, str | None]:
        """Compute actionable insights for cohorts."""
        insights: dict[str, str | None] = {}

        if len(cohort_data) == 0:
            return insights

        sorted_cohorts = sorted(cohort_data, key=lambda c: c.passRate, reverse=True)
        avg_pass_rate = sum(cohort.passRate for cohort in cohort_data) / len(
            cohort_data
        )
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

    def _compute_skill_performance_insight(
        self, radar_data: list[SkillRadarData]
    ) -> str | None:
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

        if skill_gap > 0.4:
            weakest_skill = min(radar_data, key=lambda s: s.value)
            return f"Large skill gap - focus on {weakest_skill.metric} ({round(weakest_skill.value * 100)}%)."

        if len(weak_skills) > 1:
            return "Multiple weak areas - focus on fundamentals."

        if len(weak_skills) == 1:
            return f"Focus on improving {weak_skills[0].metric} to balance skillset."

        if len(strong_skills) == len(radar_data):
            return f"Excellent proficiency across all skills (avg {round(avg_proficiency * 100)}%)."

        return None

    def _compute_scenario_performance_insight(
        self, attribute_attempt_facts: list[ScenarioAttributeAttemptFact]
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

        if best_param_item[1] - worst_param_item[1] > 20:
            return f"Performance varies significantly by scenario attributes ({best_param_item[1] - worst_param_item[1]:.0f}% gap). Review challenging scenarios."

        return None

    def _compute_scenario_stats_insight(
        self, numeric_attempt_facts: list[NumericAttemptFact]
    ) -> str | None:
        """Compute actionable insight from scenario stats data."""
        if len(numeric_attempt_facts) == 0:
            return None

        total_correlation = 0.0
        correlation_count = 0

        by_parameter: dict[str, list[NumericAttemptFact]] = {}
        for fact in numeric_attempt_facts:
            if fact.parameterId not in by_parameter:
                by_parameter[fact.parameterId] = []
            by_parameter[fact.parameterId].append(fact)

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

        if correlation_count > 0:
            avg_correlation = total_correlation / correlation_count

            if avg_correlation > 0.5:
                return "Higher difficulty levels correlate with better performance - consider increasing challenge."
            elif avg_correlation < -0.5:
                return "Performance decreases at higher difficulty - review training progression."

        return None

    def _compute_simulation_performance_insight(
        self, scenario_facts: list[ScenarioFact]
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
        self, simulation_facts: list[SimulationFact]
    ) -> str | None:
        """Compute actionable insight from simulation composition data."""
        if not simulation_facts or len(simulation_facts) == 0:
            return None

        avg_score = sum(sim.avgScore for sim in simulation_facts) / len(
            simulation_facts
        )
        avg_completion = sum(sim.completionRate for sim in simulation_facts) / len(
            simulation_facts
        )

        sorted_by_score = sorted(
            simulation_facts, key=lambda s: s.avgScore, reverse=True
        )
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
