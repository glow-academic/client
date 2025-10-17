"""Footer analytics queries - 4 metrics."""

from typing import Any, List, Optional, Tuple

from app.queries.analytics.base import AnalyticsQueryBuilder


class FooterQueries:
    """Query builders for footer analytics metrics."""

    def __init__(self) -> None:
        self.builder = AnalyticsQueryBuilder()

    def scenario_performance(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build scenario performance query."""
        where_clause, params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        query = f"""
            WITH filt AS (
                SELECT * FROM analytics a WHERE {where_clause}
            )
            SELECT json_build_object(
                'validParameterIds', '[]'::json,
                'attributeAttemptFacts', '[]'::json,
                'attributeScenarioFacts', '[]'::json
            ) AS result
        """

        return query, params

    def scenario_stats(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build scenario stats query."""
        where_clause, params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        query = f"""
            WITH filt AS (
                SELECT * FROM analytics a WHERE {where_clause}
            )
            SELECT json_build_object(
                'validNumericParameterIds', '[]'::json,
                'numericAttemptFacts', '[]'::json,
                'numericScenarioFacts', '[]'::json
            ) AS result
        """

        return query, params

    def simulation_composition(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build simulation composition query."""
        where_clause, params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        query = f"""
            WITH filt AS (
                SELECT * FROM analytics a WHERE {where_clause}
            ),
            simulation_facts AS (
                SELECT
                    f.simulation_id,
                    s.title AS simulation_title,
                    AVG(f.grade_percent)::float AS avg_score,
                    (100.0 * COUNT(*) FILTER (WHERE f.completed) / NULLIF(COUNT(*), 0))::float AS completion_rate,
                    COUNT(*)::int AS total_attempts,
                    COUNT(DISTINCT f.scenario_id)::int AS scenario_count
                FROM filt f
                JOIN simulations s ON s.id = f.simulation_id
                WHERE f.simulation_id IS NOT NULL
                GROUP BY f.simulation_id, s.title
            )
            SELECT json_build_object(
                'validSimulationIds', COALESCE((
                    SELECT json_agg(DISTINCT simulation_id::text) FROM filt WHERE simulation_id IS NOT NULL
                ), '[]'::json),
                'simulationFacts', COALESCE((SELECT json_agg(json_build_object(
                    'simulationId', simulation_id::text,
                    'title', simulation_title,
                    'avgScore', ROUND(avg_score)::int,
                    'completionRate', ROUND(completion_rate)::int,
                    'totalAttempts', total_attempts,
                    'scenarioCount', scenario_count
                )) FROM simulation_facts), '[]'::json),
                'simulationParameterFactsCategorical', '[]'::json,
                'simulationParameterFactsNumeric', '[]'::json,
                'hasData', (SELECT COUNT(*) > 0 FROM simulation_facts)
            ) AS result
        """

        return query, params

    def simulation_performance(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build simulation performance query."""
        where_clause, params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        query = f"""
            WITH filt AS (
                SELECT * FROM analytics a WHERE {where_clause}
            ),
            scenario_facts AS (
                SELECT
                    simulation_id,
                    scenario_id,
                    scenario_title,
                    AVG(grade_percent)::float AS avg_score,
                    (100.0 * COUNT(*) FILTER (WHERE grade_percent >= (rubric_pass_points * 100.0 / NULLIF(rubric_points, 0))) / NULLIF(COUNT(*), 0))::float AS success_rate,
                    COUNT(*)::int AS total_attempts,
                    COUNT(*) FILTER (WHERE completed)::int AS completed_attempts
                FROM filt
                WHERE simulation_id IS NOT NULL AND scenario_id IS NOT NULL
                GROUP BY simulation_id, scenario_id, scenario_title
            )
            SELECT json_build_object(
                'validSimulationIds', COALESCE((
                    SELECT json_agg(DISTINCT simulation_id::text) FROM filt WHERE simulation_id IS NOT NULL
                ), '[]'::json),
                'scenarioFacts', COALESCE((SELECT json_agg(json_build_object(
                    'simulationId', simulation_id::text,
                    'scenarioId', scenario_id::text,
                    'scenarioName', scenario_title,
                    'avgScore', ROUND(avg_score)::int,
                    'successRate', ROUND(success_rate)::int,
                    'totalAttempts', total_attempts,
                    'completedAttempts', completed_attempts
                )) FROM scenario_facts), '[]'::json)
            ) AS result
        """

        return query, params

