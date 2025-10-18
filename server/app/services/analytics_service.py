"""Analytics service layer - business logic for analytics operations."""

import json
from typing import Any, Awaitable, Callable, Dict, List, Optional, Tuple

import asyncpg  # type: ignore
from app.cache import keys
from app.db import get_pool, transaction
from app.extensions import get_query_client
from app.queries.analytics.base import AnalyticsQueryBuilder
from app.queries.analytics.bundle_queries import BundleQueries
from app.queries.analytics.footer_queries import FooterQueries
from app.queries.analytics.header_queries import HeaderQueries
from app.queries.analytics.leaderboard_queries import LeaderboardQueries
from app.queries.analytics.page_queries import PageQueries
from app.queries.analytics.pricing_queries import PricingQueries
from app.queries.analytics.primary_queries import PrimaryQueries
from app.queries.analytics.secondary_queries import SecondaryQueries
from app.schemas.analytics import (AnalyticsFilters, AttemptHistoryResponse,
                                   AttemptHistoryRow,
                                   AttemptImprovementResponse,
                                   CohortPerformanceResponse,
                                   DashboardBundleResponse,
                                   DashboardFooterMetrics,
                                   DashboardHeaderMetrics, DashboardInsights,
                                   DashboardPrimaryMetrics,
                                   DashboardSecondaryMetrics, DebugInfoItem,
                                   GrowthDataResponse, HomeOverviewResponse,
                                   LeaderboardBundleResponse, Method,
                                   MetricResponse, ModelMappingWithPricing,
                                   ModelRunItem, PersonaPerformanceResponse,
                                   PracticeOverviewResponse,
                                   PricingAnalyticsResponse,
                                   ReportsBundleResponse,
                                   RubricHeatmapResponse,
                                   ScenarioPerformanceResponse,
                                   ScenarioStatsResponse,
                                   SimulationCompositionResponse,
                                   SimulationPerformanceResponse,
                                   SkillPerformanceResponse, Thresholds)
from app.schemas.base import (ParameterItemMapping, ParameterItemMappingItem,
                              ParameterMapping, ParameterMappingItem,
                              PersonaMapping, PersonaMappingItem,
                              RubricMapping, RubricMappingItem,
                              ScenarioMapping, ScenarioMappingItem,
                              SimulationMapping, SimulationMappingItem)
from app.services import analytics_insights


class AnalyticsService:
    """Service layer for analytics operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database session."""
        self.conn = conn
        self.query_builder = AnalyticsQueryBuilder()
        self.header_queries = HeaderQueries()
        self.primary_queries = PrimaryQueries()
        self.secondary_queries = SecondaryQueries()
        self.footer_queries = FooterQueries()
        self.page_queries = PageQueries()
        self.bundle_queries = BundleQueries()
        self.leaderboard_queries = LeaderboardQueries()
        self.pricing_queries = PricingQueries()

    def _create_pool_fetcher(self, query_func: Callable[[], Tuple[str, List[Any]]], response_class: Any) -> Callable[[], Awaitable[Any]]:
        """
        Create a fetcher function that acquires its own database connection.
        
        This is critical for background refresh operations in the query cache.
        Background tasks must not reuse the connection from the original request,
        as asyncpg connections can only handle one operation at a time.
        
        Args:
            query_func: Function that returns (query, params) tuple
            response_class: Pydantic model class to validate the response
            
        Returns:
            Async function that acquires a connection, runs the query, and returns validated response
        """
        async def fetcher() -> Any:
            pool = get_pool()
            if not pool:
                raise RuntimeError("Database pool not available for background refresh")
            
            # Acquire own connection from pool
            async with pool.acquire() as conn:
                query, params = query_func()
                result = await conn.fetchval(query, *params)
                parsed_result = self._parse_json_strings_recursive(result or {})
                return response_class.model_validate(parsed_result)
        
        return fetcher

    def _create_pool_metric_fetcher(self, query_func: Callable[[], Tuple[str, List[Any]]], metric_name: str = "Metric") -> Callable[[], Awaitable[MetricResponse]]:
        """
        Create a metric fetcher function that acquires its own database connection.
        
        This is a specialized version of _create_pool_fetcher for metric queries
        that use the _execute_metric_query pattern.
        
        Args:
            query_func: Function that returns (query, params) tuple
            metric_name: Name of the metric for trend analysis text
            
        Returns:
            Async function that acquires a connection, runs the query, and returns MetricResponse
        """
        async def fetcher() -> MetricResponse:
            pool = get_pool()
            if not pool:
                raise RuntimeError("Database pool not available for background refresh")
            
            # Acquire own connection from pool
            async with pool.acquire() as conn:
                query, params = query_func()
                result = await conn.fetchrow(query, *params)
                
                if not result:
                    return MetricResponse(
                        hasData=False,
                        method=Method.AVG,
                        currentValue=0,
                        trendAnalysis=None,
                        trendData=[],
                        dataPoints=[],
                    )
                
                # Parse result according to _execute_metric_query logic
                parsed_result = self._parse_json_strings_recursive({
                    "hasData": result.get("has_data"),
                    "method": result.get("method"),
                    "currentValue": result.get("current_value"),
                    "trendData": result.get("trend_data"),
                    "dataPoints": result.get("data_points"),
                })
                
                # Compute trend analysis
                trend_data = parsed_result.get("trendData", [])
                trend_analysis = self._compute_trend_analysis(trend_data, metric_name) if trend_data else None
                parsed_result["trendAnalysis"] = trend_analysis
                
                return MetricResponse.model_validate(parsed_result)
        
        return fetcher

    def _compute_trend_analysis(self, trend_data: List[Any], metric_name: str) -> Optional[str]:
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
        
        recent_avg = sum(d.get('value', 0) for d in recent_data) / len(recent_data)
        earlier_avg = sum(d.get('value', 0) for d in earlier_data) / len(earlier_data)
        
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
        
        return f"{metric_name} {direction} {abs(change_percent)}% over the past {period}"

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
        self, query: str, params: List[Any], metric_name: str = "Metric"
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
        trend_data = result['trend_data']
        data_points = result['data_points']
        
        # If they're JSON strings, parse them; otherwise use as-is
        if isinstance(trend_data, str):
            trend_data = json.loads(trend_data) if trend_data else []
        if isinstance(data_points, str):
            data_points = json.loads(data_points) if data_points else []

        # Compute trend analysis from trend data
        trend_analysis = self._compute_trend_analysis(trend_data, metric_name) if trend_data else None
        
        # Parse the result into MetricResponse
        return MetricResponse(
            hasData=result['has_data'],
            method=result['method'],
            currentValue=result['current_value'],
            trendAnalysis=trend_analysis,
            valueField=result['value_field'],
            keyField=result['key_field'],
            trendData=trend_data or [],
            dataPoints=data_points or [],
        )

    # Header Analytics (10 metrics)
    async def get_average_score(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get average score metric."""
        qc = get_query_client()
        if not qc:
            # No cache available, execute directly
            query, params = self.header_queries.average_score(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
            return await self._execute_metric_query(query, params, "Average score")
        
        key = keys.analytics_average_score(filters)
        
        # Create pool-aware fetcher that acquires its own connection
        def query_func() -> Tuple[str, List[Any]]:
            return self.header_queries.average_score(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
        
        fetcher = self._create_pool_metric_fetcher(query_func, "Average score")
        result: MetricResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def get_completion_percentage(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get completion percentage metric."""
        qc = get_query_client()
        if not qc:
            query, params = self.header_queries.completion_percentage(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
            return await self._execute_metric_query(query, params, "Completion percentage")
        
        key = keys.analytics_completion_percentage(filters)
        
        # Create pool-aware fetcher that acquires its own connection
        def query_func() -> Tuple[str, List[Any]]:
            return self.header_queries.completion_percentage(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
        
        fetcher = self._create_pool_metric_fetcher(query_func, "Completion percentage")
        result: MetricResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def get_first_attempt_pass_rate(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get first attempt pass rate metric."""
        qc = get_query_client()
        if not qc:
            query, params = self.header_queries.first_attempt_pass_rate(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
            return await self._execute_metric_query(query, params, "First attempt pass rate")
        
        key = keys.analytics_first_attempt_pass_rate(filters)
        
        # Create pool-aware fetcher that acquires its own connection
        def query_func() -> Tuple[str, List[Any]]:
            return self.header_queries.first_attempt_pass_rate(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
        
        fetcher = self._create_pool_metric_fetcher(query_func, "First attempt pass rate")
        result: MetricResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def get_highest_score(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get highest score metric."""
        qc = get_query_client()
        if not qc:
            query, params = self.header_queries.highest_score(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
            return await self._execute_metric_query(query, params, "Highest score")
        
        key = keys.analytics_highest_score(filters)
        
        # Create pool-aware fetcher that acquires its own connection
        def query_func() -> Tuple[str, List[Any]]:
            return self.header_queries.highest_score(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
        
        fetcher = self._create_pool_metric_fetcher(query_func, "Highest score")
        result: MetricResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def get_messages_per_session(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get messages per session metric."""
        qc = get_query_client()
        if not qc:
            query, params = self.header_queries.messages_per_session(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
            return await self._execute_metric_query(query, params, "Messages per session")
        
        key = keys.analytics_messages_per_session(filters)
        
        # Create pool-aware fetcher that acquires its own connection
        def query_func() -> Tuple[str, List[Any]]:
            return self.header_queries.messages_per_session(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
        
        fetcher = self._create_pool_metric_fetcher(query_func, "Messages per session")
        result: MetricResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def get_persona_response_times(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get persona response times metric."""
        qc = get_query_client()
        if not qc:
            query, params = self.header_queries.persona_response_times(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
            return await self._execute_metric_query(query, params, "Response time")
        
        key = keys.analytics_persona_response_times(filters)
        
        # Create pool-aware fetcher that acquires its own connection
        def query_func() -> Tuple[str, List[Any]]:
            return self.header_queries.persona_response_times(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
        
        fetcher = self._create_pool_metric_fetcher(query_func, "Response time")
        result: MetricResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def get_session_efficiency(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get session efficiency metric."""
        qc = get_query_client()
        if not qc:
            query, params = self.header_queries.session_efficiency(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
            return await self._execute_metric_query(query, params, "Session efficiency")
        
        key = keys.analytics_session_efficiency(filters)
        
        # Create pool-aware fetcher that acquires its own connection
        def query_func() -> Tuple[str, List[Any]]:
            return self.header_queries.session_efficiency(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
        
        fetcher = self._create_pool_metric_fetcher(query_func, "Session efficiency")
        result: MetricResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def get_stagnation_rate(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get stagnation rate metric."""
        qc = get_query_client()
        if not qc:
            query, params = self.header_queries.stagnation_rate(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
            return await self._execute_metric_query(query, params, "Stagnation rate")
        
        key = keys.analytics_stagnation_rate(filters)
        
        # Create pool-aware fetcher that acquires its own connection
        def query_func() -> Tuple[str, List[Any]]:
            return self.header_queries.stagnation_rate(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
        
        fetcher = self._create_pool_metric_fetcher(query_func, "Stagnation rate")
        result: MetricResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def get_time_spent(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get time spent metric."""
        qc = get_query_client()
        if not qc:
            query, params = self.header_queries.time_spent(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
            return await self._execute_metric_query(query, params, "Time spent")
        
        key = keys.analytics_time_spent(filters)
        
        # Create pool-aware fetcher that acquires its own connection
        def query_func() -> Tuple[str, List[Any]]:
            return self.header_queries.time_spent(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
        
        fetcher = self._create_pool_metric_fetcher(query_func, "Time spent")
        result: MetricResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    async def get_total_attempts(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get total attempts metric."""
        qc = get_query_client()
        if not qc:
            query, params = self.header_queries.total_attempts(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
            return await self._execute_metric_query(query, params, "Total attempts")
        
        key = keys.analytics_total_attempts(filters)
        
        # Create pool-aware fetcher that acquires its own connection
        def query_func() -> Tuple[str, List[Any]]:
            return self.header_queries.total_attempts(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
        
        fetcher = self._create_pool_metric_fetcher(query_func, "Total attempts")
        result: MetricResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result

    # Primary Analytics (3 complex metrics)
    async def get_rubric_heatmap(self, filters: AnalyticsFilters) -> RubricHeatmapResponse:
        """Get rubric heatmap data."""
        qc = get_query_client()
        if not qc:
            query, params = self.primary_queries.rubric_heatmap(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
            result = await self.conn.fetchval(query, *params)
            parsed_result = self._parse_json_strings_recursive(result or {})
            return RubricHeatmapResponse.model_validate(parsed_result)
        
        key = keys.analytics_rubric_heatmap(filters)
        
        # Create pool-aware fetcher that acquires its own connection
        def query_func() -> Tuple[str, List[Any]]:
            return self.primary_queries.rubric_heatmap(
                start_date=filters.startDate,
                end_date=filters.endDate,
                cohort_ids=filters.cohortIds,
                roles=filters.roles,
                sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
                profile_id=filters.profileId,
                department_ids=filters.departmentIds,
            )
        
        fetcher = self._create_pool_fetcher(query_func, RubricHeatmapResponse)
        result_data: RubricHeatmapResponse = await qc.query(key, fetcher, tags=list(key.tags()), fresh_ttl=30, stale_ttl=300)
        return result_data

    async def get_growth_data(self, filters: AnalyticsFilters) -> GrowthDataResponse:
        """Get growth data."""
        query, params = self.primary_queries.growth_data(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return GrowthDataResponse.model_validate(parsed_result)

    async def get_persona_performance(self, filters: AnalyticsFilters) -> PersonaPerformanceResponse:
        """Get persona performance data."""
        query, params = self.primary_queries.persona_performance(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return PersonaPerformanceResponse.model_validate(parsed_result)

    # Secondary Analytics (3 complex metrics)
    async def get_attempt_improvement(self, filters: AnalyticsFilters) -> AttemptImprovementResponse:
        """Get attempt improvement data."""
        query, params = self.secondary_queries.attempt_improvement(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return AttemptImprovementResponse.model_validate(parsed_result)

    async def get_cohort_performance(self, filters: AnalyticsFilters) -> CohortPerformanceResponse:
        """Get cohort performance data."""
        query, params = self.secondary_queries.cohort_performance(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return CohortPerformanceResponse.model_validate(parsed_result)

    async def get_skill_performance(self, filters: AnalyticsFilters) -> SkillPerformanceResponse:
        """Get skill performance data."""
        query, params = self.secondary_queries.skill_performance(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return SkillPerformanceResponse.model_validate(parsed_result)

    # Footer Analytics (4 new metrics)
    async def get_scenario_performance(self, filters: AnalyticsFilters) -> ScenarioPerformanceResponse:
        """Get scenario performance data."""
        query, params = self.footer_queries.scenario_performance(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return ScenarioPerformanceResponse.model_validate(parsed_result)

    async def get_scenario_stats(self, filters: AnalyticsFilters) -> ScenarioStatsResponse:
        """Get scenario stats data."""
        query, params = self.footer_queries.scenario_stats(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return ScenarioStatsResponse.model_validate(parsed_result)

    async def get_simulation_composition(self, filters: AnalyticsFilters) -> SimulationCompositionResponse:
        """Get simulation composition data."""
        query, params = self.footer_queries.simulation_composition(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return SimulationCompositionResponse.model_validate(parsed_result)

    async def get_simulation_performance(self, filters: AnalyticsFilters) -> SimulationPerformanceResponse:
        """Get simulation performance data."""
        query, params = self.footer_queries.simulation_performance(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        parsed_result = self._parse_json_strings_recursive(result or {})
        return SimulationPerformanceResponse.model_validate(parsed_result)

    # Page-specific Analytics
    async def get_home_overview(self, filters: AnalyticsFilters) -> HomeOverviewResponse:
        """Get home overview data with history and simulation mapping."""
        # Determine effective profile ID based on role
        # Admins, superadmins, and instructional staff see all data (no profile filter)
        effective_profile_id = None
        if filters.profileId:
            # Fetch profile role to determine if we should use profileId
            query, params = self.query_builder.get_profile_role(filters.profileId)
            role_row = await self.conn.fetchrow(query, *params)
            if role_row:
                role = role_row['role']
                # Only use profileId for non-admin roles (ta, guest, etc.)
                if role not in ('admin', 'superadmin', 'instructional'):
                    effective_profile_id = filters.profileId
        
        # Get overview items
        query, params = self.page_queries.home_overview(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=effective_profile_id,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        # Parse JSON string to dict if needed
        if isinstance(result, str):
            result = json.loads(result)
        overview_data = result or {}
        
        # Fetch history data (use effective_profile_id)
        history_filters = AnalyticsFilters(
            startDate=filters.startDate,
            endDate=filters.endDate,
            cohortIds=filters.cohortIds,
            roles=filters.roles,
            simulationFilters=filters.simulationFilters,
            profileId=effective_profile_id,
            departmentIds=filters.departmentIds,
        )
        history = await self.get_attempt_history(history_filters)
        
        # Build simulation mapping (use effective_profile_id)
        simulation_mapping = await self._build_simulation_mapping(history_filters)
        
        return HomeOverviewResponse(
            mode=overview_data.get("mode", "empty"),
            hasData=overview_data.get("hasData", False),
            items=overview_data.get("items", []),
            history=history,
            standard_groups_mapping=overview_data.get("standard_groups_mapping", {}),
            standards_mapping=overview_data.get("standards_mapping", {}),
            simulation_mapping=simulation_mapping,
        )

    async def get_attempt_history(self, filters: AnalyticsFilters) -> AttemptHistoryResponse:
        """Get attempt history data."""
        query, params = self.page_queries.attempt_history(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        if not result:
            return []
        # Parse JSON string to list if needed
        if isinstance(result, str):
            result = json.loads(result)
        return [AttemptHistoryRow.model_validate(row) for row in result]

    async def get_practice_overview(self, filters: AnalyticsFilters) -> PracticeOverviewResponse:
        """Get practice overview data with history and all entity mappings."""
        # Get overview items
        query, params = self.page_queries.practice_overview(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        # Parse JSON string to dict if needed
        if isinstance(result, str):
            result = json.loads(result)
        overview_data = result or {}
        
        # Fetch history data
        history = await self.get_attempt_history(filters)
        
        # Build all entity mappings
        simulation_mapping = await self._build_simulation_mapping(filters)
        persona_mapping = await self._build_persona_mapping(filters)
        scenario_mapping = await self._build_scenario_mapping(filters)
        parameter_mapping = await self._build_parameter_mapping(filters)
        parameter_item_mapping = await self._build_parameter_item_mapping(filters)
        
        return PracticeOverviewResponse(
            mode=overview_data.get("mode", "practice"),
            hasData=overview_data.get("hasData", False),
            items=overview_data.get("items", []),
            history=history,
            standard_groups_mapping=overview_data.get("standard_groups_mapping", {}),
            standards_mapping=overview_data.get("standards_mapping", {}),
            simulation_mapping=simulation_mapping,
            persona_mapping=persona_mapping,
            scenario_mapping=scenario_mapping,
            parameter_mapping=parameter_mapping,
            parameter_item_mapping=parameter_item_mapping,
        )

    # Bundle Analytics
    async def get_reports_bundle(self, filters: AnalyticsFilters) -> ReportsBundleResponse:
        """Get reports bundle data with entity mappings."""
        # Get profile metrics data
        query, params = self.bundle_queries.reports_bundle(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        # Parse any JSON strings in nested structures
        parsed_result = self._parse_json_strings_recursive(result or {})
        bundle_data = parsed_result.get("data", []) if parsed_result else []
        
        # Build entity mappings (reuse methods from dashboard bundle)
        scenario_mapping = await self._build_scenario_mapping(filters)
        simulation_mapping = await self._build_simulation_mapping(filters)
        
        return ReportsBundleResponse(
            data=bundle_data,
            scenario_mapping=scenario_mapping,
            simulation_mapping=simulation_mapping,
        )

    async def get_leaderboard_bundle(self, filters: AnalyticsFilters) -> LeaderboardBundleResponse:
        """Get leaderboard bundle data."""
        query, params = self.bundle_queries.leaderboard_bundle(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)
        # Parse any JSON strings in nested structures
        parsed_result = self._parse_json_strings_recursive(result or {})
        return LeaderboardBundleResponse.model_validate(parsed_result)

    async def get_pricing_analytics(
        self, filters: AnalyticsFilters
    ) -> PricingAnalyticsResponse:
        """Get pricing analytics for model runs."""

        # Get model runs with all relationships
        query, params = self.pricing_queries.get_model_runs(
            department_ids=filters.departmentIds or [],
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
        )

        runs_result = await self.conn.fetch(query, *params)

        # Build model runs list
        model_runs = []
        model_run_ids = []

        for row in runs_result:
            model_runs.append(
                ModelRunItem(
                    model_run_id=str(row['model_run_id']),
                    created_at=row['created_at'].isoformat(),
                    input_tokens=row['input_tokens'],
                    output_tokens=row['output_tokens'],
                    model_id=str(row['model_id']) if row['model_id'] else None,
                    profile_id=str(row['profile_id']) if row['profile_id'] else None,
                    agent_id=str(row['agent_id']) if row['agent_id'] else None,
                    persona_id=str(row['persona_id']) if row['persona_id'] else None,
                    debug_info=[],  # Will be populated below
                )
            )
            model_run_ids.append(str(row['model_run_id']))

        # Get debug info for all runs
        if model_run_ids:
            query, params = self.pricing_queries.get_debug_info_for_runs(
                model_run_ids
            )
            debug_result = await self.conn.fetch(query, *params)

            # Group debug info by model_run_id
            debug_by_run: Dict[str, List[DebugInfoItem]] = {}
            for debug in debug_result:
                run_id = str(debug['model_run_id'])
                if run_id not in debug_by_run:
                    debug_by_run[run_id] = []
                debug_by_run[run_id].append(
                    DebugInfoItem(
                        id=str(debug['id']),
                        created_at=debug['created_at'].isoformat(),
                        content=debug['content'],
                    )
                )

            # Add debug info to runs
            for run in model_runs:
                run.debug_info = debug_by_run.get(run.model_run_id, [])

        # Build mappings
        model_mapping: Dict[str, ModelMappingWithPricing] = {}
        profile_mapping: Dict[str, str] = {}
        agent_mapping: Dict[str, str] = {}
        persona_mapping: Dict[str, str] = {}

        # Get model mapping with pricing
        if model_ids_to_fetch := list(
            set([r.model_id for r in model_runs if r.model_id])
        ):
            query, params = self.pricing_queries.get_model_mapping(
                model_ids_to_fetch
            )
            model_result = await self.conn.fetch(query, *params)

            for row in model_result:
                model_mapping[str(row['id'])] = ModelMappingWithPricing(
                    name=row['name'],
                    description=row['description'],
                    input_ppm=row['input_ppm'],
                    output_ppm=row['output_ppm'],
                )

        # Get profile mapping
        if profile_ids_to_fetch := list(
            set([r.profile_id for r in model_runs if r.profile_id])
        ):
            query, params = self.pricing_queries.get_profile_mapping(
                profile_ids_to_fetch
            )
            profile_result = await self.conn.fetch(query, *params)

            for row in profile_result:
                profile_mapping[str(row['id'])] = row['name']

        # Get agent mapping
        if agent_ids_to_fetch := list(
            set([r.agent_id for r in model_runs if r.agent_id])
        ):
            query, params = self.pricing_queries.get_agent_mapping(agent_ids_to_fetch)
            agent_result = await self.conn.fetch(query, *params)

            for row in agent_result:
                agent_mapping[str(row['id'])] = row['name']

        # Get persona mapping
        if persona_ids_to_fetch := list(
            set([r.persona_id for r in model_runs if r.persona_id])
        ):
            query, params = self.pricing_queries.get_persona_mapping(
                persona_ids_to_fetch
            )
            persona_result = await self.conn.fetch(query, *params)

            for row in persona_result:
                persona_mapping[str(row['id'])] = row['name']

        return PricingAnalyticsResponse(
            model_runs=model_runs,
            model_mapping=model_mapping,
            profile_mapping=profile_mapping,
            agent_mapping=agent_mapping,
            persona_mapping=persona_mapping,
        )

    # Leaderboard-Specific Metrics (3 additional metrics)
    async def get_improvement_per_day(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get improvement per day metric."""
        query, params = self.leaderboard_queries.improvement_per_day(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Improvement per day")

    async def get_perfect_scores(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get perfect scores metric."""
        query, params = self.leaderboard_queries.perfect_scores(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Perfect scores")

    async def get_quickest_pass(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get quickest pass metric."""
        query, params = self.leaderboard_queries.quickest_pass(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return await self._execute_metric_query(query, params, "Quickest pass")

    # Utility
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

    async def _build_scenario_mapping(self, filters: AnalyticsFilters) -> ScenarioMapping:
        """Build scenario mapping from database."""
        query, params = self.query_builder.get_scenarios_for_mapping(filters.departmentIds)
        results = await self.conn.fetch(query, *params)
        
        return {
            str(row['id']): ScenarioMappingItem(
                name=row['name'],
                description=row['problem_statement'] or "",
                persona_id=None,
                persona_mapping={},
                document_mapping={},
                parameter_item_mapping={},
                parameter_item_ids=[],
                document_ids=[],
            )
            for row in results
        }

    async def _build_simulation_mapping(
        self, filters: AnalyticsFilters
    ) -> SimulationMapping:
        """Build simulation mapping from database - only practice simulations."""
        # Get only practice simulations for the practice page
        query, params = self.query_builder.get_simulations_for_mapping(filters.departmentIds)
        results = await self.conn.fetch(query, *params)
        
        return {
            str(row['id']): SimulationMappingItem(
                name=row['title'],
                description=row['description'] or "",
            )
            for row in results
        }

    async def _build_rubric_mapping(self, filters: AnalyticsFilters) -> RubricMapping:
        """Build rubric mapping from database."""
        query, params = self.query_builder.get_rubrics_for_mapping(filters.departmentIds)
        results = await self.conn.fetch(query, *params)
        
        return {
            str(row['id']): RubricMappingItem(
                name=row['name'],
                description=row['description'] or "",
            )
            for row in results
        }

    async def _build_parameter_mapping(self, filters: AnalyticsFilters) -> ParameterMapping:
        """Build parameter mapping from database - only non-default parameters for customization."""
        query, params = self.query_builder.get_parameters_for_mapping(filters.departmentIds)
        results = await self.conn.fetch(query, *params)
        
        return {
            str(row['id']): ParameterMappingItem(
                name=row['name'],
                description=row['description'] or "",
            )
            for row in results
        }

    async def _build_parameter_item_mapping(
        self, filters: AnalyticsFilters
    ) -> ParameterItemMapping:
        """Build parameter item mapping from database - only default items for non-default parameters."""
        query, params = self.query_builder.get_parameter_items_for_mapping(filters.departmentIds)
        results = await self.conn.fetch(query, *params)
        
        return {
            str(row['id']): ParameterItemMappingItem(
                name=row['name'],
                description=row['description'] or "",
                parameter_id=str(row["parameter_id"]),
                parameter_name=row["parameter_name"],
            )
            for row in results
        }

    async def _build_persona_mapping(self, filters: AnalyticsFilters) -> PersonaMapping:
        """Build persona mapping from database."""
        query, params = self.query_builder.get_personas_for_mapping(filters.departmentIds)
        results = await self.conn.fetch(query, *params)
        
        return {
            str(row['id']): PersonaMappingItem(
                name=row['name'],
                description=row['description'] or "",
                color=row['color'],
                icon=row['icon'],
            )
            for row in results
        }

    async def refresh_materialized_view(self) -> None:
        """Refresh the analytics materialized view and invalidate all analytics caches."""
        query = self.query_builder.refresh_materialized_view()
        await self.conn.execute(query)
        
        # Invalidate all analytics caches since the materialized view data has changed
        qc = get_query_client()
        if qc:
            await qc.invalidate(tags=[keys.tag_analytics_all()])


def get_analytics_service(conn: asyncpg.Connection) -> AnalyticsService:
    """Get analytics service instance."""
    return AnalyticsService(conn)

