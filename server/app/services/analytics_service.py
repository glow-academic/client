"""Analytics service layer - business logic for analytics operations."""

from typing import Any, Dict, List, Optional

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
                                   SkillPerformanceResponse)
from app.schemas.base import (ParameterItemMapping, ParameterItemMappingItem,
                              ParameterMapping, ParameterMappingItem,
                              RubricMapping, RubricMappingItem,
                              SimulationMapping, SimulationMappingItem)
from app.services import analytics_insights
from sqlalchemy import text
from sqlalchemy.orm import Session


class AnalyticsService:
    """Service layer for analytics operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self.header_queries = HeaderQueries()
        self.primary_queries = PrimaryQueries()
        self.secondary_queries = SecondaryQueries()
        self.footer_queries = FooterQueries()
        self.page_queries = PageQueries()
        self.bundle_queries = BundleQueries()
        self.leaderboard_queries = LeaderboardQueries()
        self.pricing_queries = PricingQueries()

    def _execute_metric_query(
        self, query: str, params: Dict[str, Any]
    ) -> MetricResponse:
        """Execute a metric query and parse the result."""
        result = self.db.execute(text(query), params).fetchone()
        
        if not result:
            return MetricResponse(
                hasData=False,
                method=Method.AVG,
                trendData=[],
                dataPoints=[],
            )

        # Parse the result into MetricResponse
        return MetricResponse(
            hasData=result.has_data,
            method=result.method,
            valueField=result.value_field,
            keyField=result.key_field,
            trendData=result.trend_data or [],
            dataPoints=result.data_points or [],
        )

    # Header Analytics (10 metrics)
    def get_average_score(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get average score metric."""
        query, params = self.header_queries.average_score(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return self._execute_metric_query(query, params)

    def get_completion_percentage(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get completion percentage metric."""
        query, params = self.header_queries.completion_percentage(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return self._execute_metric_query(query, params)

    def get_first_attempt_pass_rate(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get first attempt pass rate metric."""
        query, params = self.header_queries.first_attempt_pass_rate(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return self._execute_metric_query(query, params)

    def get_highest_score(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get highest score metric."""
        query, params = self.header_queries.highest_score(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return self._execute_metric_query(query, params)

    def get_messages_per_session(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get messages per session metric."""
        query, params = self.header_queries.messages_per_session(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return self._execute_metric_query(query, params)

    def get_persona_response_times(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get persona response times metric."""
        query, params = self.header_queries.persona_response_times(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return self._execute_metric_query(query, params)

    def get_session_efficiency(
        self, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Get session efficiency metric."""
        query, params = self.header_queries.session_efficiency(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return self._execute_metric_query(query, params)

    def get_stagnation_rate(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get stagnation rate metric."""
        query, params = self.header_queries.stagnation_rate(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return self._execute_metric_query(query, params)

    def get_time_spent(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get time spent metric."""
        query, params = self.header_queries.time_spent(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return self._execute_metric_query(query, params)

    def get_total_attempts(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get total attempts metric."""
        query, params = self.header_queries.total_attempts(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return self._execute_metric_query(query, params)

    # Primary Analytics (3 complex metrics)
    def get_rubric_heatmap(self, filters: AnalyticsFilters) -> RubricHeatmapResponse:
        """Get rubric heatmap data."""
        query, params = self.primary_queries.rubric_heatmap(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = self.db.execute(text(query), params).scalar()
        return RubricHeatmapResponse.model_validate(result or {})

    def get_growth_data(self, filters: AnalyticsFilters) -> GrowthDataResponse:
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
        result = self.db.execute(text(query), params).scalar()
        return GrowthDataResponse.model_validate(result or {})

    def get_persona_performance(self, filters: AnalyticsFilters) -> PersonaPerformanceResponse:
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
        result = self.db.execute(text(query), params).scalar()
        return PersonaPerformanceResponse.model_validate(result or {})

    # Secondary Analytics (3 complex metrics)
    def get_attempt_improvement(self, filters: AnalyticsFilters) -> AttemptImprovementResponse:
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
        result = self.db.execute(text(query), params).scalar()
        return AttemptImprovementResponse.model_validate(result or {})

    def get_cohort_performance(self, filters: AnalyticsFilters) -> CohortPerformanceResponse:
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
        result = self.db.execute(text(query), params).scalar()
        return CohortPerformanceResponse.model_validate(result or {})

    def get_skill_performance(self, filters: AnalyticsFilters) -> SkillPerformanceResponse:
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
        result = self.db.execute(text(query), params).scalar()
        return SkillPerformanceResponse.model_validate(result or {})

    # Footer Analytics (4 new metrics)
    def get_scenario_performance(self, filters: AnalyticsFilters) -> ScenarioPerformanceResponse:
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
        result = self.db.execute(text(query), params).scalar()
        return ScenarioPerformanceResponse.model_validate(result or {})

    def get_scenario_stats(self, filters: AnalyticsFilters) -> ScenarioStatsResponse:
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
        result = self.db.execute(text(query), params).scalar()
        return ScenarioStatsResponse.model_validate(result or {})

    def get_simulation_composition(self, filters: AnalyticsFilters) -> SimulationCompositionResponse:
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
        result = self.db.execute(text(query), params).scalar()
        return SimulationCompositionResponse.model_validate(result or {})

    def get_simulation_performance(self, filters: AnalyticsFilters) -> SimulationPerformanceResponse:
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
        result = self.db.execute(text(query), params).scalar()
        return SimulationPerformanceResponse.model_validate(result or {})

    # Page-specific Analytics
    def get_home_overview(self, filters: AnalyticsFilters) -> HomeOverviewResponse:
        """Get home overview data."""
        query, params = self.page_queries.home_overview(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = self.db.execute(text(query), params).scalar()
        return HomeOverviewResponse.model_validate(result or {})

    def get_attempt_history(self, filters: AnalyticsFilters) -> AttemptHistoryResponse:
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
        result = self.db.execute(text(query), params).scalar()
        if not result:
            return []
        return [AttemptHistoryRow.model_validate(row) for row in result]

    def get_practice_overview(self, filters: AnalyticsFilters) -> PracticeOverviewResponse:
        """Get practice overview data."""
        query, params = self.page_queries.practice_overview(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = self.db.execute(text(query), params).scalar()
        return PracticeOverviewResponse.model_validate(result or {})

    # Bundle Analytics
    def get_reports_bundle(self, filters: AnalyticsFilters) -> ReportsBundleResponse:
        """Get reports bundle data."""
        query, params = self.bundle_queries.reports_bundle(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters] if filters.simulationFilters else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = self.db.execute(text(query), params).scalar()
        return ReportsBundleResponse.model_validate(result or {})

    def get_leaderboard_bundle(self, filters: AnalyticsFilters) -> LeaderboardBundleResponse:
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
        result = self.db.execute(text(query), params).scalar()
        return LeaderboardBundleResponse.model_validate(result or {})

    def get_pricing_analytics(
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

        runs_result = self.db.execute(text(query), params).fetchall()

        # Build model runs list
        model_runs = []
        model_run_ids = []

        for row in runs_result:
            model_runs.append(
                ModelRunItem(
                    model_run_id=str(row.model_run_id),
                    created_at=row.created_at.isoformat(),
                    input_tokens=row.input_tokens,
                    output_tokens=row.output_tokens,
                    model_id=str(row.model_id) if row.model_id else None,
                    profile_id=str(row.profile_id) if row.profile_id else None,
                    agent_id=str(row.agent_id) if row.agent_id else None,
                    persona_id=str(row.persona_id) if row.persona_id else None,
                    debug_info=[],  # Will be populated below
                )
            )
            model_run_ids.append(str(row.model_run_id))

        # Get debug info for all runs
        if model_run_ids:
            query, params = self.pricing_queries.get_debug_info_for_runs(
                model_run_ids
            )
            debug_result = self.db.execute(text(query), params).fetchall()

            # Group debug info by model_run_id
            debug_by_run: Dict[str, List[DebugInfoItem]] = {}
            for debug in debug_result:
                run_id = str(debug.model_run_id)
                if run_id not in debug_by_run:
                    debug_by_run[run_id] = []
                debug_by_run[run_id].append(
                    DebugInfoItem(
                        id=str(debug.id),
                        created_at=debug.created_at.isoformat(),
                        content=debug.content,
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
            model_result = self.db.execute(text(query), params).fetchall()

            for row in model_result:
                model_mapping[str(row.id)] = ModelMappingWithPricing(
                    name=row.name,
                    description=row.description,
                    input_ppm=row.input_ppm,
                    output_ppm=row.output_ppm,
                )

        # Get profile mapping
        if profile_ids_to_fetch := list(
            set([r.profile_id for r in model_runs if r.profile_id])
        ):
            query, params = self.pricing_queries.get_profile_mapping(
                profile_ids_to_fetch
            )
            profile_result = self.db.execute(text(query), params).fetchall()

            for row in profile_result:
                profile_mapping[str(row.id)] = row.name

        # Get agent mapping
        if agent_ids_to_fetch := list(
            set([r.agent_id for r in model_runs if r.agent_id])
        ):
            query, params = self.pricing_queries.get_agent_mapping(agent_ids_to_fetch)
            agent_result = self.db.execute(text(query), params).fetchall()

            for row in agent_result:
                agent_mapping[str(row.id)] = row.name

        # Get persona mapping
        if persona_ids_to_fetch := list(
            set([r.persona_id for r in model_runs if r.persona_id])
        ):
            query, params = self.pricing_queries.get_persona_mapping(
                persona_ids_to_fetch
            )
            persona_result = self.db.execute(text(query), params).fetchall()

            for row in persona_result:
                persona_mapping[str(row.id)] = row.name

        return PricingAnalyticsResponse(
            model_runs=model_runs,
            model_mapping=model_mapping,
            profile_mapping=profile_mapping,
            agent_mapping=agent_mapping,
            persona_mapping=persona_mapping,
        )

    # Leaderboard-Specific Metrics (3 additional metrics)
    def get_improvement_per_day(self, filters: AnalyticsFilters) -> MetricResponse:
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
        return self._execute_metric_query(query, params)

    def get_perfect_scores(self, filters: AnalyticsFilters) -> MetricResponse:
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
        return self._execute_metric_query(query, params)

    def get_quickest_pass(self, filters: AnalyticsFilters) -> MetricResponse:
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
        return self._execute_metric_query(query, params)

    # Utility
    def get_dashboard_bundle(
        self, filters: AnalyticsFilters
    ) -> DashboardBundleResponse:
        """
        Get complete dashboard bundle with all metrics, history, insights, and mappings.
        
        This consolidates 21+ individual API calls into a single response.
        """
        # Fetch all header metrics (10 metrics)
        header = DashboardHeaderMetrics(
            average_score=self.get_average_score(filters),
            completion_percentage=self.get_completion_percentage(filters),
            first_attempt_pass_rate=self.get_first_attempt_pass_rate(filters),
            highest_score=self.get_highest_score(filters),
            messages_per_session=self.get_messages_per_session(filters),
            persona_response_times=self.get_persona_response_times(filters),
            session_efficiency=self.get_session_efficiency(filters),
            stagnation_rate=self.get_stagnation_rate(filters),
            time_spent=self.get_time_spent(filters),
            total_attempts=self.get_total_attempts(filters),
        )

        # Fetch all primary metrics (3 metrics)
        growth_data = self.get_growth_data(filters)
        persona_performance = self.get_persona_performance(filters)
        rubric_heatmap = self.get_rubric_heatmap(filters)

        primary = DashboardPrimaryMetrics(
            growth_data=growth_data,
            persona_performance=persona_performance,
            rubric_heatmap=rubric_heatmap,
        )

        # Fetch all secondary metrics (3 metrics)
        attempt_improvement = self.get_attempt_improvement(filters)
        cohort_performance = self.get_cohort_performance(filters)
        skill_performance = self.get_skill_performance(filters)

        secondary = DashboardSecondaryMetrics(
            attempt_improvement=attempt_improvement,
            cohort_performance=cohort_performance,
            skill_performance=skill_performance,
        )

        # Fetch all footer metrics (4 metrics)
        scenario_performance = self.get_scenario_performance(filters)
        scenario_stats = self.get_scenario_stats(filters)
        simulation_performance = self.get_simulation_performance(filters)
        simulation_composition = self.get_simulation_composition(filters)

        footer = DashboardFooterMetrics(
            scenario_performance=scenario_performance,
            scenario_stats=scenario_stats,
            simulation_performance=simulation_performance,
            simulation_composition=simulation_composition,
        )

        # Fetch history data
        history = self.get_attempt_history(filters)

        # Build entity mappings
        simulation_mapping = self._build_simulation_mapping(filters)
        rubric_mapping = self._build_rubric_mapping(filters)
        parameter_mapping = self._build_parameter_mapping(filters)
        parameter_item_mapping = self._build_parameter_item_mapping(filters)

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

        return DashboardBundleResponse(
            header=header,
            primary=primary,
            secondary=secondary,
            footer=footer,
            history=history,
            insights=insights,
            simulation_mapping=simulation_mapping,
            rubric_mapping=rubric_mapping,
            parameter_mapping=parameter_mapping,
            parameter_item_mapping=parameter_item_mapping,
        )

    def _build_simulation_mapping(
        self, filters: AnalyticsFilters
    ) -> SimulationMapping:
        """Build simulation mapping from database."""
        # Get all unique simulation IDs from the dashboard data
        query = text("""
            SELECT DISTINCT s.id, s.title, s.description
            FROM simulations s
            WHERE (:department_ids::uuid[] IS NULL OR s.department_id = ANY(:department_ids::uuid[]))
            AND s.active = true
        """)
        params = {
            "department_ids": filters.departmentIds,
        }
        
        results = self.db.execute(query, params).fetchall()
        
        return {
            str(row.id): SimulationMappingItem(
                name=row.title,
                description=row.description or "",
            )
            for row in results
        }

    def _build_rubric_mapping(self, filters: AnalyticsFilters) -> RubricMapping:
        """Build rubric mapping from database."""
        query = text("""
            SELECT DISTINCT r.id, r.name, r.description
            FROM rubrics r
            WHERE (:department_ids::uuid[] IS NULL OR r.department_id = ANY(:department_ids::uuid[]))
            AND r.active = true
        """)
        params = {
            "department_ids": filters.departmentIds,
        }
        
        results = self.db.execute(query, params).fetchall()
        
        return {
            str(row.id): RubricMappingItem(
                name=row.name,
                description=row.description or "",
            )
            for row in results
        }

    def _build_parameter_mapping(self, filters: AnalyticsFilters) -> ParameterMapping:
        """Build parameter mapping from database."""
        query = text("""
            SELECT DISTINCT p.id, p.name, p.description
            FROM parameters p
            WHERE (:department_ids::uuid[] IS NULL OR p.department_id = ANY(:department_ids::uuid[]))
            AND p.active = true
        """)
        params = {
            "department_ids": filters.departmentIds,
        }
        
        results = self.db.execute(query, params).fetchall()
        
        return {
            str(row.id): ParameterMappingItem(
                name=row.name,
                description=row.description or "",
            )
            for row in results
        }

    def _build_parameter_item_mapping(
        self, filters: AnalyticsFilters
    ) -> ParameterItemMapping:
        """Build parameter item mapping from database."""
        query = text("""
            SELECT DISTINCT pi.id, pi.name, pi.description, pi.parameter_id, p.name as parameter_name
            FROM parameter_items pi
            JOIN parameters p ON pi.parameter_id = p.id
            WHERE (:department_ids::uuid[] IS NULL OR p.department_id = ANY(:department_ids::uuid[]))
            AND p.active = true
        """)
        params = {
            "department_ids": filters.departmentIds,
        }
        
        results = self.db.execute(query, params).fetchall()
        
        return {
            str(row.id): ParameterItemMappingItem(
                name=row.name,
                description=row.description or "",
                parameter_id=str(row.parameter_id),
                parameter_name=row.parameter_name,
            )
            for row in results
        }

    def refresh_materialized_view(self) -> None:
        """Refresh the analytics materialized view."""
        query = text("REFRESH MATERIALIZED VIEW CONCURRENTLY analytics")
        self.db.execute(query)
        self.db.commit()


def get_analytics_service(db: Session) -> AnalyticsService:
    """Get analytics service instance."""
    return AnalyticsService(db)

