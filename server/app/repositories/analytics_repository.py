"""Analytics repository for database operations."""

from typing import Any, Dict, List, Optional, Type, TypeVar

from app.db import get_session
from app.schemas.analytics import (AnalyticsFilters, AttemptHistoryResponse,
                                   AttemptHistoryRow,
                                   AttemptImprovementResponse,
                                   CohortPerformanceResponse,
                                   GrowthDataResponse, HomeOverviewResponse,
                                   LeaderboardBundleResponse, MetricResponse,
                                   PersonaPerformanceResponse,
                                   PracticeOverviewResponse,
                                   ReportsBundleResponse,
                                   RubricHeatmapResponse,
                                   ScenarioPerformanceResponse,
                                   ScenarioStatsResponse,
                                   SimulationCompositionResponse,
                                   SimulationPerformanceResponse,
                                   SkillPerformanceResponse)
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

T = TypeVar("T", bound=BaseModel)


class AnalyticsRepository:
    """Repository for analytics operations."""

    def __init__(self, db: Session):
        """Initialize repository with database session."""
        self.db = db

    @staticmethod
    def _prepare_filters(filters: AnalyticsFilters) -> Dict[str, Any]:
        """Prepare filters for SQL function calls."""
        return {
            "start_date": filters.startDate,
            "end_date": filters.endDate,
            "cohort_ids": filters.cohortIds,
            "roles": filters.roles,
            "sim_filters": filters.simulationFilters,
            "profile_id": filters.profileId,
            "department_ids": filters.departmentIds,
        }

    def _execute_metric_function(
        self, fn_name: str, filters: AnalyticsFilters
    ) -> MetricResponse:
        """Execute a metric function and return parsed response."""
        params = self._prepare_filters(filters)

        # Build SQL query
        query = text(
            f"""
            SELECT {fn_name}(
                :start_date::timestamptz,
                :end_date::timestamptz,
                :cohort_ids::uuid[],
                :roles::profile_role[],
                :sim_filters::text[],
                :profile_id::uuid,
                :department_ids::uuid[]
            ) AS result
        """
        )

        result = self.db.execute(query, params).scalar()
        return MetricResponse.model_validate(result or {})

    def _execute_primary_function(
        self, fn_name: str, filters: AnalyticsFilters, response_class: Type[T]
    ) -> T:
        """Execute a primary analytics function and return parsed response."""
        params = self._prepare_filters(filters)

        query = text(
            f"""
            SELECT {fn_name}(
                :start_date::timestamptz,
                :end_date::timestamptz,
                :cohort_ids::uuid[],
                :roles::profile_role[],
                :sim_filters::text[],
                :profile_id::uuid,
                :department_ids::uuid[]
            ) AS result
        """
        )

        result = self.db.execute(query, params).scalar()
        return response_class.model_validate(result or {})

    # Header Analytics (10 metrics)
    def get_average_score(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get average score metric."""
        return self._execute_metric_function("analytics_average_score_fn", filters)

    def get_completion_percentage(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get completion percentage metric."""
        return self._execute_metric_function(
            "analytics_completion_percentage_fn", filters
        )

    def get_first_attempt_pass_rate(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get first attempt pass rate metric."""
        return self._execute_metric_function(
            "analytics_first_attempt_pass_rate_fn", filters
        )

    def get_highest_score(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get highest score metric."""
        return self._execute_metric_function("analytics_highest_score_fn", filters)

    def get_messages_per_session(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get messages per session metric."""
        return self._execute_metric_function(
            "analytics_messages_per_session_fn", filters
        )

    def get_persona_response_times(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get persona response times metric."""
        return self._execute_metric_function(
            "analytics_persona_response_times_fn", filters
        )

    def get_session_efficiency(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get session efficiency metric."""
        return self._execute_metric_function(
            "analytics_session_efficiency_fn", filters
        )

    def get_stagnation_rate(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get stagnation rate metric."""
        return self._execute_metric_function("analytics_stagnation_rate_fn", filters)

    def get_time_spent(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get time spent metric."""
        return self._execute_metric_function("analytics_time_spent_fn", filters)

    def get_total_attempts(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get total attempts metric."""
        return self._execute_metric_function("analytics_total_attempts_fn", filters)

    # Primary Analytics (3 complex metrics)
    def get_rubric_heatmap(
        self, filters: AnalyticsFilters
    ) -> RubricHeatmapResponse:
        """Get rubric heatmap data."""
        return self._execute_primary_function(
            "analytics_rubric_heatmap_fn", filters, RubricHeatmapResponse
        )

    def get_growth_data(self, filters: AnalyticsFilters) -> GrowthDataResponse:
        """Get growth data."""
        return self._execute_primary_function(
            "analytics_growth_data_fn", filters, GrowthDataResponse
        )

    def get_persona_performance(
        self, filters: AnalyticsFilters
    ) -> PersonaPerformanceResponse:
        """Get persona performance data."""
        return self._execute_primary_function(
            "analytics_persona_performance_fn", filters, PersonaPerformanceResponse
        )

    # Secondary Analytics (3 complex metrics)
    def get_attempt_improvement(
        self, filters: AnalyticsFilters
    ) -> AttemptImprovementResponse:
        """Get attempt improvement data."""
        return self._execute_primary_function(
            "analytics_attempt_improvement_fn", filters, AttemptImprovementResponse
        )

    def get_cohort_performance(
        self, filters: AnalyticsFilters
    ) -> CohortPerformanceResponse:
        """Get cohort performance data."""
        return self._execute_primary_function(
            "analytics_cohort_performance_fn", filters, CohortPerformanceResponse
        )

    def get_skill_performance(
        self, filters: AnalyticsFilters
    ) -> SkillPerformanceResponse:
        """Get skill performance data."""
        return self._execute_primary_function(
            "analytics_skill_performance_fn", filters, SkillPerformanceResponse
        )

    # Footer Analytics (4 new metrics)
    def get_scenario_performance(
        self, filters: AnalyticsFilters
    ) -> ScenarioPerformanceResponse:
        """Get scenario performance data."""
        return self._execute_primary_function(
            "analytics_scenario_performance_fn", filters, ScenarioPerformanceResponse
        )

    def get_scenario_stats(
        self, filters: AnalyticsFilters
    ) -> ScenarioStatsResponse:
        """Get scenario stats data."""
        return self._execute_primary_function(
            "analytics_scenario_stats_fn", filters, ScenarioStatsResponse
        )

    def get_simulation_composition(
        self, filters: AnalyticsFilters
    ) -> SimulationCompositionResponse:
        """Get simulation composition data."""
        return self._execute_primary_function(
            "analytics_simulation_composition_fn",
            filters,
            SimulationCompositionResponse,
        )

    def get_simulation_performance(
        self, filters: AnalyticsFilters
    ) -> SimulationPerformanceResponse:
        """Get simulation performance data."""
        return self._execute_primary_function(
            "analytics_simulation_performance_fn",
            filters,
            SimulationPerformanceResponse,
        )

    # Page-specific Analytics
    def get_home_overview(self, filters: AnalyticsFilters) -> HomeOverviewResponse:
        """Get home overview data."""
        return self._execute_primary_function(
            "analytics_home_overview_fn", filters, HomeOverviewResponse
        )

    def get_attempt_history(
        self, filters: AnalyticsFilters
    ) -> AttemptHistoryResponse:
        """Get attempt history data."""
        params = self._prepare_filters(filters)

        query = text(
            """
            SELECT analytics_attempt_history_fn(
                :start_date::timestamptz,
                :end_date::timestamptz,
                :cohort_ids::uuid[],
                :roles::profile_role[],
                :sim_filters::text[],
                :profile_id::uuid,
                :department_ids::uuid[]
            ) AS result
        """
        )

        result = self.db.execute(query, params).scalar()
        # Result is a list, not a dict
        if not result:
            return []
        # Parse each row as AttemptHistoryRow
        return [AttemptHistoryRow.model_validate(row) for row in result]

    def get_practice_overview(
        self, filters: AnalyticsFilters
    ) -> PracticeOverviewResponse:
        """Get practice overview data."""
        return self._execute_primary_function(
            "analytics_practice_overview_fn", filters, PracticeOverviewResponse
        )

    # Bundle Analytics
    def get_reports_bundle(
        self, filters: AnalyticsFilters
    ) -> ReportsBundleResponse:
        """Get reports bundle data."""
        return self._execute_primary_function(
            "analytics_reports_bundle_fn", filters, ReportsBundleResponse
        )

    def get_leaderboard_bundle(
        self, filters: AnalyticsFilters
    ) -> LeaderboardBundleResponse:
        """Get leaderboard bundle data."""
        return self._execute_primary_function(
            "analytics_leaderboard_bundle_fn", filters, LeaderboardBundleResponse
        )

    # Utility
    def refresh_materialized_view(self) -> None:
        """Refresh the analytics materialized view."""
        query = text("REFRESH MATERIALIZED VIEW CONCURRENTLY analytics")
        self.db.execute(query)
        self.db.commit()


def get_analytics_repository(db: Optional[Session] = None) -> AnalyticsRepository:
    """Get analytics repository instance."""
    if db is None:
        db = next(get_session())
    return AnalyticsRepository(db)

