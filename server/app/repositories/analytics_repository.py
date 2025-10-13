"""Analytics repository for database operations.

Note: This repository now delegates to the analytics service layer
which uses Python SQL queries instead of stored procedures.
"""

from typing import Optional

from app.db import get_session
from app.schemas.analytics import (AnalyticsFilters, AttemptHistoryResponse,
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
from app.services.analytics_service import get_analytics_service
from sqlalchemy.orm import Session


class AnalyticsRepository:
    """
    Repository for analytics operations.
    
    This repository now uses the analytics service layer which executes
    Python SQL queries instead of calling PostgreSQL stored procedures.
    """

    def __init__(self, db: Session):
        """Initialize repository with database session."""
        self.db = db
        self.service = get_analytics_service(db)


    # Header Analytics (10 metrics) - Now using service layer
    def get_average_score(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get average score metric."""
        return self.service.get_average_score(filters)

    def get_completion_percentage(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get completion percentage metric."""
        return self.service.get_completion_percentage(filters)

    def get_first_attempt_pass_rate(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get first attempt pass rate metric."""
        return self.service.get_first_attempt_pass_rate(filters)

    def get_highest_score(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get highest score metric."""
        return self.service.get_highest_score(filters)

    def get_messages_per_session(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get messages per session metric."""
        return self.service.get_messages_per_session(filters)

    def get_persona_response_times(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get persona response times metric."""
        return self.service.get_persona_response_times(filters)

    def get_session_efficiency(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get session efficiency metric."""
        return self.service.get_session_efficiency(filters)

    def get_stagnation_rate(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get stagnation rate metric."""
        return self.service.get_stagnation_rate(filters)

    def get_time_spent(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get time spent metric."""
        return self.service.get_time_spent(filters)

    def get_total_attempts(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get total attempts metric."""
        return self.service.get_total_attempts(filters)

    # Primary Analytics (3 complex metrics) - Now using service layer
    def get_rubric_heatmap(
        self, filters: AnalyticsFilters
    ) -> RubricHeatmapResponse:
        """Get rubric heatmap data."""
        return self.service.get_rubric_heatmap(filters)

    def get_growth_data(self, filters: AnalyticsFilters) -> GrowthDataResponse:
        """Get growth data."""
        return self.service.get_growth_data(filters)

    def get_persona_performance(
        self, filters: AnalyticsFilters
    ) -> PersonaPerformanceResponse:
        """Get persona performance data."""
        return self.service.get_persona_performance(filters)

    # Secondary Analytics (3 complex metrics) - Now using service layer
    def get_attempt_improvement(
        self, filters: AnalyticsFilters
    ) -> AttemptImprovementResponse:
        """Get attempt improvement data."""
        return self.service.get_attempt_improvement(filters)

    def get_cohort_performance(
        self, filters: AnalyticsFilters
    ) -> CohortPerformanceResponse:
        """Get cohort performance data."""
        return self.service.get_cohort_performance(filters)

    def get_skill_performance(
        self, filters: AnalyticsFilters
    ) -> SkillPerformanceResponse:
        """Get skill performance data."""
        return self.service.get_skill_performance(filters)

    # Footer Analytics (4 new metrics) - Now using service layer
    def get_scenario_performance(
        self, filters: AnalyticsFilters
    ) -> ScenarioPerformanceResponse:
        """Get scenario performance data."""
        return self.service.get_scenario_performance(filters)

    def get_scenario_stats(
        self, filters: AnalyticsFilters
    ) -> ScenarioStatsResponse:
        """Get scenario stats data."""
        return self.service.get_scenario_stats(filters)

    def get_simulation_composition(
        self, filters: AnalyticsFilters
    ) -> SimulationCompositionResponse:
        """Get simulation composition data."""
        return self.service.get_simulation_composition(filters)

    def get_simulation_performance(
        self, filters: AnalyticsFilters
    ) -> SimulationPerformanceResponse:
        """Get simulation performance data."""
        return self.service.get_simulation_performance(filters)

    # Page-specific Analytics - Now using service layer
    def get_home_overview(self, filters: AnalyticsFilters) -> HomeOverviewResponse:
        """Get home overview data."""
        return self.service.get_home_overview(filters)

    def get_attempt_history(
        self, filters: AnalyticsFilters
    ) -> AttemptHistoryResponse:
        """Get attempt history data."""
        return self.service.get_attempt_history(filters)

    def get_practice_overview(
        self, filters: AnalyticsFilters
    ) -> PracticeOverviewResponse:
        """Get practice overview data."""
        return self.service.get_practice_overview(filters)

    # Bundle Analytics - Now using service layer
    def get_reports_bundle(
        self, filters: AnalyticsFilters
    ) -> ReportsBundleResponse:
        """Get reports bundle data."""
        return self.service.get_reports_bundle(filters)

    def get_leaderboard_bundle(
        self, filters: AnalyticsFilters
    ) -> LeaderboardBundleResponse:
        """Get leaderboard bundle data."""
        return self.service.get_leaderboard_bundle(filters)

    # Leaderboard-Specific Metrics (3 additional metrics) - Now using service layer
    def get_improvement_per_day(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get improvement per day metric."""
        return self.service.get_improvement_per_day(filters)

    def get_perfect_scores(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get perfect scores metric."""
        return self.service.get_perfect_scores(filters)

    def get_quickest_pass(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get quickest pass metric."""
        return self.service.get_quickest_pass(filters)

    # Utility
    def refresh_materialized_view(self) -> None:
        """Refresh the analytics materialized view."""
        return self.service.refresh_materialized_view()


def get_analytics_repository(db: Optional[Session] = None) -> AnalyticsRepository:
    """Get analytics repository instance."""
    if db is None:
        db = next(get_session())
    return AnalyticsRepository(db)

