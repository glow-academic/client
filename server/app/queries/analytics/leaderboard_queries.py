"""Leaderboard-specific analytics queries - 3 metrics."""

from typing import Any, List, Optional, Tuple

from app.queries.analytics.base import AnalyticsQueryBuilder


class LeaderboardQueries:
    """Query builders for leaderboard-specific metrics."""

    def __init__(self) -> None:
        self.builder = AnalyticsQueryBuilder()

    def improvement_per_day(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build improvement per day query - maximum improvement rate across simulations."""
        where_clause, params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        query = """
            WITH filt AS (
                SELECT * FROM analytics a WHERE """ + where_clause + """
            ),
            attempts_by_sim AS (
                SELECT 
                    simulation_id,
                    attempt_id,
                    profile_id,
                    chat_created_at,
                    grade_percent
                FROM filt
                WHERE grade_percent IS NOT NULL
                  AND attempt_id IS NOT NULL
            ),
            attempt_grades AS (
                SELECT 
                    simulation_id,
                    attempt_id,
                    profile_id,
                    MIN(chat_created_at) as first_time,
                    MAX(grade_percent) as best_grade
                FROM attempts_by_sim
                GROUP BY simulation_id, attempt_id, profile_id
            ),
            sim_rates AS (
                SELECT 
                    simulation_id,
                    profile_id,
                    CASE 
                        WHEN COUNT(*) >= 2 THEN
                            ROUND(
                                (MAX(best_grade) - MIN(best_grade)) / 
                                GREATEST(1.0, 
                                    EXTRACT(EPOCH FROM (MAX(first_time) - MIN(first_time))) / 86400.0
                                )
                            )::int
                        ELSE 0
                    END AS improvement_rate
                FROM attempt_grades
                GROUP BY simulation_id, profile_id
            ),
            max_rates AS (
                SELECT 
                    profile_id,
                    COALESCE(MAX(improvement_rate), 0) AS max_improvement_rate
                FROM sim_rates
                GROUP BY profile_id
            ),
            by_day AS (
                SELECT
                    to_char(date_trunc('day', chat_created_at), 'YYYY-MM-DD') AS date,
                    AVG(grade_percent)::float AS value,
                    COUNT(*)::int AS count
                FROM filt
                WHERE grade_percent IS NOT NULL
                GROUP BY date
            ),
            data_points AS (
                SELECT
                    profile_id::text,
                    max_improvement_rate AS value,
                    1 AS count
                FROM max_rates
            )
            SELECT
                (SELECT COUNT(*) > 0 FROM filt WHERE grade_percent IS NOT NULL) AS has_data,
                'max' AS method,
                NULL AS value_field,
                NULL AS key_field,
                COALESCE((SELECT json_agg(json_build_object(
                    'date', date,
                    'value', ROUND(COALESCE(value, 0))::int,
                    'count', count
                ) ORDER BY date) FROM by_day), '[]'::json) AS trend_data,
                COALESCE((SELECT json_agg(json_build_object(
                    'profileId', profile_id,
                    'value', value,
                    'count', count
                ) ORDER BY profile_id) FROM data_points), '[]'::json) AS data_points,
                json_build_object(
                    'maxRate', COALESCE((SELECT MAX(max_improvement_rate) FROM max_rates), 0)
                ) AS hover
        """

        return query, params

    def perfect_scores(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build perfect scores query - count of 100% grade sessions."""
        where_clause, params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        query = """
            WITH filt AS (
                SELECT * FROM analytics a WHERE """ + where_clause + """
            ),
            perfects AS (
                SELECT *
                FROM filt
                WHERE grade_percent IS NOT NULL
                  AND grade_percent >= 100.0
            ),
            by_day AS (
                SELECT
                    to_char(date_trunc('day', chat_created_at), 'YYYY-MM-DD') AS date,
                    COUNT(*)::int AS value,
                    COUNT(*)::int AS count
                FROM perfects
                GROUP BY date
            ),
            data_points AS (
                SELECT
                    profile_id::text,
                    to_char(date_trunc('day', chat_created_at), 'YYYY-MM-DD') AS date,
                    1 AS value,
                    simulation_id::text
                FROM perfects
                ORDER BY profile_id, chat_created_at
            )
            SELECT
                (SELECT COUNT(*) > 0 FROM perfects) AS has_data,
                'sum' AS method,
                NULL AS value_field,
                NULL AS key_field,
                COALESCE((SELECT json_agg(json_build_object(
                    'date', date,
                    'value', value,
                    'count', count
                ) ORDER BY date) FROM by_day), '[]'::json) AS trend_data,
                COALESCE((SELECT json_agg(json_build_object(
                    'profileId', profile_id,
                    'date', date,
                    'value', value,
                    'simulationId', simulation_id
                ) ORDER BY profile_id, chat_created_at) FROM data_points), '[]'::json) AS data_points
        """

        return query, params

    def quickest_pass(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """Build quickest pass query - fastest time-to-pass in minutes."""
        where_clause, params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        query = """
            WITH filt AS (
                SELECT * FROM analytics a WHERE """ + where_clause + """
            ),
            passes AS (
                SELECT *
                FROM filt
                WHERE passed IS TRUE
                  AND time_taken_seconds IS NOT NULL
            ),
            by_day AS (
                SELECT
                    to_char(date_trunc('day', chat_created_at), 'YYYY-MM-DD') AS date,
                    ROUND(MIN(time_taken_seconds) / 60.0)::int AS value,
                    COUNT(*)::int AS count
                FROM passes
                GROUP BY date
            ),
            data_points AS (
                SELECT
                    profile_id::text,
                    to_char(date_trunc('day', chat_created_at), 'YYYY-MM-DD') AS date,
                    ROUND(time_taken_seconds / 60.0)::int AS value,
                    simulation_id::text
                FROM passes
                ORDER BY profile_id, time_taken_seconds, chat_created_at
            )
            SELECT
                (SELECT COUNT(*) > 0 FROM passes) AS has_data,
                'min' AS method,
                NULL AS value_field,
                NULL AS key_field,
                COALESCE((SELECT json_agg(json_build_object(
                    'date', date,
                    'value', value,
                    'count', count
                ) ORDER BY date) FROM by_day), '[]'::json) AS trend_data,
                COALESCE((SELECT json_agg(json_build_object(
                    'profileId', profile_id,
                    'date', date,
                    'value', value,
                    'simulationId', simulation_id
                ) ORDER BY profile_id, date) FROM data_points), '[]'::json) AS data_points
        """

        return query, params

