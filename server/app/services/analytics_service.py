"""Analytics service layer - business logic for analytics operations."""

from typing import Any, Dict, List, Optional

from app.queries.analytics.bundle_queries import BundleQueries
from app.queries.analytics.footer_queries import FooterQueries
from app.queries.analytics.header_queries import HeaderQueries
from app.queries.analytics.leaderboard_queries import LeaderboardQueries
from app.queries.analytics.page_queries import PageQueries
from app.queries.analytics.primary_queries import PrimaryQueries
from app.queries.analytics.secondary_queries import SecondaryQueries
from app.schemas.analytics import (AnalyticsFilters, AttemptHistoryResponse,
                                   AttemptHistoryRow,
                                   AttemptImprovementResponse,
                                   CohortPerformanceResponse,
                                   GrowthDataResponse, HomeOverviewResponse,
                                   LeaderboardBundleResponse, Method,
                                   MetricResponse, PersonaPerformanceResponse,
                                   PracticeOverviewResponse,
                                   ReportsBundleResponse,
                                   RubricHeatmapResponse,
                                   ScenarioPerformanceResponse,
                                   ScenarioStatsResponse,
                                   SimulationCompositionResponse,
                                   SimulationPerformanceResponse,
                                   SkillPerformanceResponse)
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
    def refresh_materialized_view(self) -> None:
        """Refresh the analytics materialized view."""
        query = text("REFRESH MATERIALIZED VIEW CONCURRENTLY analytics")
        self.db.execute(query)
        self.db.commit()


def get_analytics_service(db: Session) -> AnalyticsService:
    """Get analytics service instance."""
    return AnalyticsService(db)

