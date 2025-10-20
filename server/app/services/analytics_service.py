"""Analytics service layer - business logic for analytics operations."""

import json
from typing import Any

import asyncpg  # type: ignore
from app.cache import keys
from app.queries.analytics.base import AnalyticsQueryBuilder
from app.queries.analytics.bundle_queries import BundleQueries
from app.queries.analytics.footer_queries import FooterQueries
from app.queries.analytics.header_queries import HeaderQueries
from app.queries.analytics.leaderboard_queries import LeaderboardQueries
from app.queries.analytics.page_queries import PageQueries
from app.queries.analytics.primary_queries import PrimaryQueries
from app.queries.analytics.secondary_queries import SecondaryQueries
from app.schemas.analytics import (AnalyticsFilters,
                                   AttemptImprovementResponse,
                                   CohortPerformanceResponse,
                                   DashboardBundleResponse,
                                   DashboardFooterMetrics,
                                   DashboardHeaderMetrics, DashboardInsights,
                                   DashboardPrimaryMetrics,
                                   DashboardSecondaryMetrics,
                                   GrowthDataResponse, Method, MetricResponse,
                                   PersonaPerformanceResponse,
                                   RubricHeatmapResponse,
                                   ScenarioPerformanceResponse,
                                   ScenarioStatsResponse,
                                   SimulationCompositionResponse,
                                   SimulationPerformanceResponse,
                                   SkillPerformanceResponse, Thresholds)
from app.schemas.base import (ParameterItemMapping, ParameterItemMappingItem,
                              ParameterMapping, ParameterMappingItem,
                              RubricMapping, RubricMappingItem,
                              SimulationMapping, SimulationMappingItem)
from app.services import analytics_insights
from app.services.base import BaseService, with_cache


class AnalyticsService(BaseService):
    """Service layer for analytics operations."""

    def __init__(self, conn: asyncpg.Connection) -> None:
        """Initialize service with database session."""
        super().__init__(conn)
        self.query_builder = AnalyticsQueryBuilder()
        self.header_queries = HeaderQueries()
        self.primary_queries = PrimaryQueries()
        self.secondary_queries = SecondaryQueries()
        self.footer_queries = FooterQueries()
        self.page_queries = PageQueries()
        self.bundle_queries = BundleQueries()
        self.leaderboard_queries = LeaderboardQueries()

    def _compute_trend_analysis(
        self, trend_data: list[Any], metric_name: str
    ) -> str | None:
        """
        Compute trend analysis text from trend data.

        Replicates client-side computeTrendAnalysis logic:
        - Compares recent 3 data points vs first 3 data points
        - Calculates percent change
        - Returns descriptive text or None
        """
        if not trend_data or len(trend_data) < 2:
            return None

        recent_data = trend_data[-3:]
        earlier_data = trend_data[:3]

        if not recent_data or not earlier_data:
            return None

        recent_avg = sum(d.get("value", 0) for d in recent_data) / len(recent_data)
        earlier_avg = sum(d.get("value", 0) for d in earlier_data) / len(earlier_data)

        change = recent_avg - earlier_avg
        change_percent = round((change / earlier_avg) * 100) if earlier_avg > 0 else 0

        if abs(change_percent) < 1:
            return None

        # Determine period based on data length
        if len(trend_data) <= 7:
            period = "3 days"
        elif len(trend_data) <= 14:
            period = "1 week"
        else:
            period = "1 month"

        direction = "increased" if change_percent > 0 else "decreased"

        return (
            f"{metric_name} {direction} {abs(change_percent)}% over the past {period}"
        )

    def _parse_json_strings_recursive(self, obj: Any) -> Any:
        """Recursively parse JSON strings in nested structures.

        This handles cases where PostgreSQL json_agg returns JSON strings
        instead of parsed objects, particularly for trendData and dataPoints fields.
        """
        if isinstance(obj, str):
            # Try to parse as JSON
            try:
                return json.loads(obj)
            except (json.JSONDecodeError, ValueError):
                return obj
        elif isinstance(obj, dict):
            # Recursively process dictionary values
            return {k: self._parse_json_strings_recursive(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            # Recursively process list items
            return [self._parse_json_strings_recursive(item) for item in obj]
        else:
            return obj

    async def _execute_metric_query(
        self, query: str, params: list[Any], metric_name: str = "Metric"
    ) -> MetricResponse:
        """Execute a metric query and parse the result."""
        result = await self.conn.fetchrow(query, *params)

        if not result:
            return MetricResponse(
                hasData=False,
                method=Method.AVG,
                currentValue=0,
                trendData=[],
                dataPoints=[],
            )

        # Parse JSON strings from database into Python lists
        trend_data = result["trend_data"]
        data_points = result["data_points"]

        # If they're JSON strings, parse them; otherwise use as-is
        if isinstance(trend_data, str):
            trend_data = json.loads(trend_data) if trend_data else []
        if isinstance(data_points, str):
            data_points = json.loads(data_points) if data_points else []

        # Compute trend analysis from trend data
        trend_analysis = (
            self._compute_trend_analysis(trend_data, metric_name)
            if trend_data
            else None
        )

        # Parse the result into MetricResponse
        return MetricResponse(
            hasData=result["has_data"],
            method=result["method"],
            currentValue=result["current_value"],
            trendAnalysis=trend_analysis,
            valueField=result["value_field"],
            keyField=result["key_field"],
            trendData=trend_data or [],
            dataPoints=data_points or [],
        )

    # Header Analytics (10 metrics)
    @with_cache(lambda self, filters: keys.analytics_average_score(filters))
    async def get_average_score(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get average score metric."""
        query, params = self.header_queries.average_score(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Average score")

    @with_cache(lambda self, filters: keys.analytics_completion_percentage(filters))
    async def get_completion_percentage(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get completion percentage metric."""
        query, params = self.header_queries.completion_percentage(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Completion percentage")

    @with_cache(lambda self, filters: keys.analytics_first_attempt_pass_rate(filters))
    async def get_first_attempt_pass_rate(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get first attempt pass rate metric."""
        query, params = self.header_queries.first_attempt_pass_rate(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(
            query, params, "First attempt pass rate"
        )

    @with_cache(lambda self, filters: keys.analytics_highest_score(filters))
    async def get_highest_score(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get highest score metric."""
        query, params = self.header_queries.highest_score(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Highest score")

    @with_cache(lambda self, filters: keys.analytics_messages_per_session(filters))
    async def get_messages_per_session(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get messages per session metric."""
        query, params = self.header_queries.messages_per_session(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Messages per session")

    @with_cache(lambda self, filters: keys.analytics_persona_response_times(filters))
    async def get_persona_response_times(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get persona response times metric."""
        query, params = self.header_queries.persona_response_times(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Response time")

    @with_cache(lambda self, filters: keys.analytics_session_efficiency(filters))
    async def get_session_efficiency(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get session efficiency metric."""
        query, params = self.header_queries.session_efficiency(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Session efficiency")

    @with_cache(lambda self, filters: keys.analytics_stagnation_rate(filters))
    async def get_stagnation_rate(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get stagnation rate metric."""
        query, params = self.header_queries.stagnation_rate(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Stagnation rate")

    @with_cache(lambda self, filters: keys.analytics_time_spent(filters))
    async def get_time_spent(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get time spent metric."""
        query, params = self.header_queries.time_spent(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Time spent")

    @with_cache(lambda self, filters: keys.analytics_total_attempts(filters))
    async def get_total_attempts(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get total attempts metric."""
        query, params = self.header_queries.total_attempts(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Total attempts")

    # Primary Analytics (3 complex metrics)
    @with_cache(lambda self, filters: keys.analytics_rubric_heatmap(filters))
    async def get_rubric_heatmap(
        self, filters: AnalyticsFilters
    ) -> RubricHeatmapResponse:
        """Get rubric heatmap data."""
        query, params = self.primary_queries.rubric_heatmap(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return RubricHeatmapResponse.model_validate(parsed_result)

    @with_cache(lambda self, filters: keys.analytics_growth_data(filters))
    async def get_growth_data(self, filters: AnalyticsFilters) -> GrowthDataResponse:
        """Get growth data by combining multiple header metrics."""
        from collections import defaultdict
        from datetime import datetime, timedelta

        # Get all 9 metrics in a single query
        query, params = self.header_queries.growth_data_bundle(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )

        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})

        # Extract metric results from bundled query
        metric_results = {
            "averageScore": parsed_result.get("averageScore", []),
            "passRate": parsed_result.get("passRate", []),
            "completionRate": parsed_result.get("completionRate", []),
            "messagesPerSession": parsed_result.get("messagesPerSession", []),
            "personaResponseTimes": parsed_result.get("personaResponseTimes", []),
            "sessionEfficiency": parsed_result.get("sessionEfficiency", []),
            "stagnationRate": parsed_result.get("stagnationRate", []),
            "timeSpent": parsed_result.get("timeSpent", []),
            "totalAttempts": parsed_result.get("totalAttempts", []),
        }

        # Combine all metrics by date
        date_map: dict[str, dict[str, Any]] = defaultdict(dict)
        for metric_name, trend_data in metric_results.items():
            if isinstance(trend_data, list):
                for point in trend_data:
                    if isinstance(point, dict):
                        date = point.get("date")
                        value = point.get("value")
                        if date:
                            date_map[date][metric_name] = value
                            if metric_name == "passRate":
                                # firstAttemptPassRate is synonym for passRate
                                date_map[date]["firstAttemptPassRate"] = value

        # Build chartData array
        chart_data = []
        for date in sorted(date_map.keys()):
            values = date_map[date]
            # Only include days where at least one metric has non-null data
            if any(v is not None for v in values.values()):
                chart_data.append({"date": date, **dict(values.items())})

        # Build availableMetrics
        available_metrics = [
            {
                "id": "averageScore",
                "name": "Average Score",
                "color": "#3b82f6",
                "unit": "%",
                "description": "Average performance score",
                "formatterId": "percent",
            },
            {
                "id": "passRate",
                "name": "Pass Rate",
                "color": "#10b981",
                "unit": "%",
                "description": "Passes on first attempt",
                "formatterId": "percent",
            },
            {
                "id": "completionRate",
                "name": "Completion Rate",
                "color": "#22c55e",
                "unit": "%",
                "description": "Sessions completed",
                "formatterId": "percent",
            },
            {
                "id": "firstAttemptPassRate",
                "name": "First Attempt Pass",
                "color": "#0ea5e9",
                "unit": "%",
                "description": "First try pass rate",
                "formatterId": "percent",
            },
            {
                "id": "messagesPerSession",
                "name": "Messages/Session",
                "color": "#f59e0b",
                "unit": "msgs",
                "description": "Average message count",
                "formatterId": "int",
            },
            {
                "id": "personaResponseTimes",
                "name": "Response Time",
                "color": "#a855f7",
                "unit": "sec",
                "description": "Avg reply latency",
                "formatterId": "sec",
            },
            {
                "id": "sessionEfficiency",
                "name": "Efficiency",
                "color": "#8b5cf6",
                "unit": "%",
                "description": "Score per time proxy",
                "formatterId": "percent",
            },
            {
                "id": "stagnationRate",
                "name": "Stagnation",
                "color": "#ef4444",
                "unit": "%",
                "description": "Stalled sessions share",
                "formatterId": "percent",
            },
            {
                "id": "timeSpent",
                "name": "Time Spent",
                "color": "#64748b",
                "unit": "min",
                "description": "Total time spent (minutes)",
                "formatterId": "minutes",
            },
            {
                "id": "totalAttempts",
                "name": "Total Attempts",
                "color": "#14b8a6",
                "unit": "attempts",
                "description": "Attempt count",
                "formatterId": "int",
            },
        ]

        # Calculate window averages for averageScore
        window_n = 7
        avg_scores = [
            (
                datetime.fromisoformat(d["date"].replace("Z", "+00:00")),
                d.get("averageScore"),
            )
            for d in chart_data
            if d.get("averageScore") is not None
        ]

        last_avg = None
        prev_avg = None
        if avg_scores:
            avg_scores.sort(key=lambda x: x[0])
            max_date = avg_scores[-1][0]

            # Last N days average
            last_n = [
                score
                for date, score in avg_scores
                if date > max_date - timedelta(days=window_n) and score is not None
            ]
            last_avg = sum(last_n) / len(last_n) if last_n else None

            # Previous N days average
            prev_n = [
                score
                for date, score in avg_scores
                if max_date - timedelta(days=2 * window_n)
                < date
                <= max_date - timedelta(days=window_n)
                and score is not None
            ]
            prev_avg = sum(prev_n) / len(prev_n) if prev_n else None

        window_averages = {
            "averageScore": {
                "n": window_n,
                "last": round(last_avg) if last_avg is not None else None,
                "prev": prev_avg if prev_avg is not None else None,
            }
        }

        return GrowthDataResponse.model_validate(
            {
                "chartData": chart_data,
                "availableMetrics": available_metrics,
                "windowAverages": window_averages,
            }
        )

    @with_cache(lambda self, filters: keys.analytics_persona_performance(filters))
    async def get_persona_performance(
        self, filters: AnalyticsFilters
    ) -> PersonaPerformanceResponse:
        """Get persona performance data."""
        query, params = self.primary_queries.persona_performance(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return PersonaPerformanceResponse.model_validate(parsed_result)

    # Secondary Analytics (3 complex metrics)
    @with_cache(lambda self, filters: keys.analytics_attempt_improvement(filters))
    async def get_attempt_improvement(
        self, filters: AnalyticsFilters
    ) -> AttemptImprovementResponse:
        """Get attempt improvement data."""
        query, params = self.secondary_queries.attempt_improvement(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return AttemptImprovementResponse.model_validate(parsed_result)

    @with_cache(lambda self, filters: keys.analytics_cohort_performance(filters))
    async def get_cohort_performance(
        self, filters: AnalyticsFilters
    ) -> CohortPerformanceResponse:
        """Get cohort performance data."""
        query, params = self.secondary_queries.cohort_performance(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return CohortPerformanceResponse.model_validate(parsed_result)

    @with_cache(lambda self, filters: keys.analytics_skill_performance(filters))
    async def get_skill_performance(
        self, filters: AnalyticsFilters
    ) -> SkillPerformanceResponse:
        """Get skill performance data."""
        query, params = self.secondary_queries.skill_performance(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return SkillPerformanceResponse.model_validate(parsed_result)

    # Footer Analytics (4 new metrics)
    @with_cache(lambda self, filters: keys.analytics_scenario_performance(filters))
    async def get_scenario_performance(
        self, filters: AnalyticsFilters
    ) -> ScenarioPerformanceResponse:
        """Get scenario performance data."""
        query, params = self.footer_queries.scenario_performance(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return ScenarioPerformanceResponse.model_validate(parsed_result)

    @with_cache(lambda self, filters: keys.analytics_scenario_stats(filters))
    async def get_scenario_stats(
        self, filters: AnalyticsFilters
    ) -> ScenarioStatsResponse:
        """Get scenario stats data."""
        query, params = self.footer_queries.scenario_stats(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return ScenarioStatsResponse.model_validate(parsed_result)

    @with_cache(lambda self, filters: keys.analytics_simulation_composition(filters))
    async def get_simulation_composition(
        self, filters: AnalyticsFilters
    ) -> SimulationCompositionResponse:
        """Get simulation composition data."""
        query, params = self.footer_queries.simulation_composition(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return SimulationCompositionResponse.model_validate(parsed_result)

    @with_cache(lambda self, filters: keys.analytics_simulation_performance(filters))
    async def get_simulation_performance(
        self, filters: AnalyticsFilters
    ) -> SimulationPerformanceResponse:
        """Get simulation performance data."""
        query, params = self.footer_queries.simulation_performance(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return SimulationPerformanceResponse.model_validate(parsed_result)

    # Page-specific Analytics

    # Bundle Analytics
    # NOTE: get_leaderboard_bundle moved to leaderboard_service.py

    # Leaderboard-Specific Metrics (3 additional metrics) - DEPRECATED
    # NOTE: These methods are kept for backward compatibility with deprecated individual
    # metric endpoints in leaderboard.py. New code should use LeaderboardService.
    @with_cache(lambda self, filters: keys.analytics_improvement_per_day(filters))
    async def get_improvement_per_day(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """DEPRECATED: Use LeaderboardService.get_leaderboard_bundle() instead."""
        query, params = self.leaderboard_queries.improvement_per_day(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Improvement per day")

    @with_cache(lambda self, filters: keys.analytics_perfect_scores(filters))
    async def get_perfect_scores(self, filters: AnalyticsFilters) -> MetricResponse:
        """DEPRECATED: Use LeaderboardService.get_leaderboard_bundle() instead."""
        query, params = self.leaderboard_queries.perfect_scores(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Perfect scores")

    @with_cache(lambda self, filters: keys.analytics_quickest_pass(filters))
    async def get_quickest_pass(self, filters: AnalyticsFilters) -> MetricResponse:
        """DEPRECATED: Use LeaderboardService.get_leaderboard_bundle() instead."""
        query, params = self.leaderboard_queries.quickest_pass(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Quickest pass")

    # Utility
    @with_cache(lambda self, filters: keys.analytics_dashboard_bundle(filters))
    async def get_dashboard_bundle(
        self, filters: AnalyticsFilters
    ) -> DashboardBundleResponse:
        """
        Get complete dashboard bundle with all metrics, history, insights, and mappings.

        This consolidates 21+ individual API calls into a single response.
        """
        # Fetch all header metrics (10 metrics)
        header = DashboardHeaderMetrics(
            average_score=await self.get_average_score(filters),
            completion_percentage=await self.get_completion_percentage(filters),
            first_attempt_pass_rate=await self.get_first_attempt_pass_rate(filters),
            highest_score=await self.get_highest_score(filters),
            messages_per_session=await self.get_messages_per_session(filters),
            persona_response_times=await self.get_persona_response_times(filters),
            session_efficiency=await self.get_session_efficiency(filters),
            stagnation_rate=await self.get_stagnation_rate(filters),
            time_spent=await self.get_time_spent(filters),
            total_attempts=await self.get_total_attempts(filters),
        )

        # Fetch all primary metrics (3 metrics)
        growth_data = await self.get_growth_data(filters)
        persona_performance = await self.get_persona_performance(filters)
        rubric_heatmap = await self.get_rubric_heatmap(filters)

        primary = DashboardPrimaryMetrics(
            growth_data=growth_data,
            persona_performance=persona_performance,
            rubric_heatmap=rubric_heatmap,
        )

        # Fetch all secondary metrics (3 metrics)
        attempt_improvement = await self.get_attempt_improvement(filters)
        cohort_performance = await self.get_cohort_performance(filters)
        skill_performance = await self.get_skill_performance(filters)

        secondary = DashboardSecondaryMetrics(
            attempt_improvement=attempt_improvement,
            cohort_performance=cohort_performance,
            skill_performance=skill_performance,
        )

        # Fetch all footer metrics (4 metrics)
        scenario_performance = await self.get_scenario_performance(filters)
        scenario_stats = await self.get_scenario_stats(filters)
        simulation_performance = await self.get_simulation_performance(filters)
        simulation_composition = await self.get_simulation_composition(filters)

        footer = DashboardFooterMetrics(
            scenario_performance=scenario_performance,
            scenario_stats=scenario_stats,
            simulation_performance=simulation_performance,
            simulation_composition=simulation_composition,
        )

        # Fetch history data
        history = await self.get_attempt_history(filters)

        # Build entity mappings
        simulation_mapping = await self._build_simulation_mapping(filters)
        rubric_mapping = await self._build_rubric_mapping(filters)
        parameter_mapping = await self._build_parameter_mapping(filters)
        parameter_item_mapping = await self._build_parameter_item_mapping(filters)

        # Compute all actionable insights using the insights service
        insights = DashboardInsights(
            growth=analytics_insights.compute_growth_actionable_insight(
                growth_data.windowAverages
            ),
            persona={
                persona_data.name: analytics_insights.compute_persona_multiple_actionable_insights(
                    persona_data.trendData,
                    persona_data.name,
                    persona_data.score,
                ).get("insight")
                for persona_data in persona_performance.chartData
            },
            rubric_heatmap=analytics_insights.compute_rubric_heatmap_actionable_insight(
                rubric_heatmap.matrices
            ),
            attempt_improvement=analytics_insights.compute_attempt_improvement_actionable_insight(
                attempt_improvement.chartData
            ),
            cohort={
                cohort_id: insights_dict.get("insight")
                for cohort_id, insights_dict in analytics_insights.compute_cohort_multiple_actionable_insights(
                    cohort_performance.cohortData
                ).items()
            },
            skill_performance=analytics_insights.compute_skill_performance_actionable_insight(
                skill_performance.packages[0].radarData
                if skill_performance.packages
                else []
            ),
            scenario_performance=analytics_insights.compute_scenario_performance_actionable_insight(
                scenario_performance.attributeAttemptFacts
            ),
            scenario_stats=analytics_insights.compute_scenario_stats_actionable_insight(
                scenario_stats.numericAttemptFacts
            ),
            simulation_performance=analytics_insights.compute_simulation_performance_actionable_insight(
                simulation_performance.scenarioFacts
            ),
            simulation_composition=analytics_insights.compute_simulation_composition_actionable_insight(
                simulation_composition.simulationFacts
            ),
        )

        # Standard thresholds for all metrics
        thresholds = Thresholds(
            danger=60,
            warning=75,
            success=85,
        )

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

    async def _build_simulation_mapping(
        self, filters: AnalyticsFilters
    ) -> SimulationMapping:
        """Build simulation mapping from database - only practice simulations."""
        # Get only practice simulations for the practice page
        query, params = self.query_builder.get_simulations_for_mapping(
            filters.departmentIds
        )
        results = await self.conn.fetch(query, *params)

        return {
            str(row["id"]): SimulationMappingItem(
                name=row["title"],
                description=row["description"] or "",
            )
            for row in results
        }

    async def _build_rubric_mapping(self, filters: AnalyticsFilters) -> RubricMapping:
        """Build rubric mapping from database."""
        query, params = self.query_builder.get_rubrics_for_mapping(
            filters.departmentIds
        )
        results = await self.conn.fetch(query, *params)

        return {
            str(row["id"]): RubricMappingItem(
                name=row["name"],
                description=row["description"] or "",
            )
            for row in results
        }

    async def _build_parameter_mapping(
        self, filters: AnalyticsFilters
    ) -> ParameterMapping:
        """Build parameter mapping from database - only non-default parameters for customization."""
        query, params = self.query_builder.get_parameters_for_mapping(
            filters.departmentIds
        )
        results = await self.conn.fetch(query, *params)

        return {
            str(row["id"]): ParameterMappingItem(
                name=row["name"],
                description=row["description"] or "",
            )
            for row in results
        }

    async def _build_parameter_item_mapping(
        self, filters: AnalyticsFilters
    ) -> ParameterItemMapping:
        """Build parameter item mapping from database - only default items for non-default parameters."""
        query, params = self.query_builder.get_parameter_items_for_mapping(
            filters.departmentIds
        )
        results = await self.conn.fetch(query, *params)

        return {
            str(row["id"]): ParameterItemMappingItem(
                name=row["name"],
                description=row["description"] or "",
                parameter_id=str(row["parameter_id"]),
                parameter_name=row["parameter_name"],
            )
            for row in results
        }

    async def refresh_materialized_view(self) -> None:
        """Refresh the analytics materialized view and invalidate all analytics caches."""
        query = self.query_builder.refresh_materialized_view()
        await self.conn.execute(query)

        # Invalidate all analytics caches since the materialized view data has changed
        await self._invalidate_cache([keys.tag_analytics_all()])


def get_analytics_service(conn: asyncpg.Connection) -> AnalyticsService:
    """Get analytics service instance."""
    return AnalyticsService(conn)
