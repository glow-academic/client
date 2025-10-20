"""Leaderboard-specific analytics queries - bundle query for leaderboard page."""

from typing import Any

from app.services.base import AnalyticsQueryBuilder


class LeaderboardQueries:
    """Query builders for leaderboard-specific metrics."""

    def __init__(self) -> None:
        self.builder = AnalyticsQueryBuilder()

    def improvement_per_day(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
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

        query = (
            """
            WITH filt AS (
                SELECT * FROM analytics a WHERE """
            + where_clause
            + """
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
        )

        return query, params

    def perfect_scores(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
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

        query = (
            """
            WITH filt AS (
                SELECT * FROM analytics a WHERE """
            + where_clause
            + """
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
        )

        return query, params

    def quickest_pass(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
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

        query = (
            """
            WITH filt AS (
                SELECT * FROM analytics a WHERE """
            + where_clause
            + """
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
        )

        return query, params

    def leaderboard_bundle(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build leaderboard bundle query."""
        where_clause, params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        query = (
            """
            WITH filt AS (
                SELECT * FROM analytics a WHERE """
            + where_clause
            + """
            ),
            profile_stats AS (
                SELECT
                    f.profile_id,
                    p.first_name,
                    p.last_name,
                    COUNT(*)::int AS total_attempts,
                    MAX(f.grade_percent) AS highest_score,
                    AVG(f.num_messages_total) AS avg_messages,
                    AVG(f.time_taken_seconds / 60.0) AS avg_time
                FROM filt f
                JOIN profiles p ON f.profile_id = p.id
                WHERE f.grade_percent IS NOT NULL
                GROUP BY f.profile_id, p.first_name, p.last_name
            ),
            -- Persona response times per profile
            persona_times AS (
                SELECT
                    f.profile_id,
                    UNNEST(f.message_time_taken_seconds) AS delta_sec
                FROM filt f
                WHERE cardinality(f.message_time_taken_seconds) > 0
            ),
            persona_per_profile AS (
                SELECT
                    profile_id,
                    ROUND(AVG(delta_sec))::int AS avg_response_time
                FROM persona_times
                GROUP BY profile_id
            ),
            -- Improvement rate per day per profile
            attempt_grades AS (
                SELECT
                    simulation_id,
                    attempt_id,
                    profile_id,
                    MIN(chat_created_at) as first_time,
                    MAX(grade_percent) as best_grade
                FROM filt
                WHERE grade_percent IS NOT NULL AND attempt_id IS NOT NULL
                GROUP BY simulation_id, attempt_id, profile_id
            ),
            sim_improvement_rates AS (
                SELECT
                    profile_id,
                    simulation_id,
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
                GROUP BY profile_id, simulation_id
            ),
            improvement_per_profile AS (
                SELECT
                    profile_id,
                    MAX(improvement_rate) AS max_improvement_rate
                FROM sim_improvement_rates
                GROUP BY profile_id
            ),
            -- Perfect score count per profile
            perfect_per_profile AS (
                SELECT
                    profile_id,
                    COUNT(*) AS perfect_count
                FROM filt
                WHERE grade_percent >= 100.0
                GROUP BY profile_id
            ),
            -- Quickest pass per profile
            quickest_per_profile AS (
                SELECT
                    profile_id,
                    MIN(time_taken_seconds / 60.0) AS quickest_minutes
                FROM filt
                WHERE passed = TRUE AND time_taken_seconds IS NOT NULL
                GROUP BY profile_id
            ),
            -- Join all metrics together
            all_stats AS (
                SELECT
                    ps.*,
                    COALESCE(pp.avg_response_time, 0) AS persona_response_time,
                    COALESCE(ip.max_improvement_rate, 0) AS improvement_rate,
                    COALESCE(pf.perfect_count, 0) AS perfect_count,
                    COALESCE(qp.quickest_minutes, 0) AS quickest_pass
                FROM profile_stats ps
                LEFT JOIN persona_per_profile pp ON ps.profile_id = pp.profile_id
                LEFT JOIN improvement_per_profile ip ON ps.profile_id = ip.profile_id
                LEFT JOIN perfect_per_profile pf ON ps.profile_id = pf.profile_id
                LEFT JOIN quickest_per_profile qp ON ps.profile_id = qp.profile_id
            )
            SELECT json_build_object(
                'data', COALESCE((SELECT json_agg(json_build_object(
                    'profileId', profile_id::text,
                    'firstName', first_name,
                    'lastName', last_name,
                    'metrics', json_build_object(
                        'totalAttempts', json_build_object(
                            'hasData', true,
                            'method', 'countDistinct',
                            'currentValue', total_attempts,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'highestScoreAvg', json_build_object(
                            'hasData', true,
                            'method', 'max',
                            'currentValue', ROUND(highest_score)::int,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'messagesPerSession', json_build_object(
                            'hasData', true,
                            'method', 'avg',
                            'currentValue', ROUND(avg_messages)::int,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'personaResponseSeconds', json_build_object(
                            'hasData', persona_response_time > 0,
                            'method', 'avg',
                            'currentValue', persona_response_time,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'timeSpentMinutes', json_build_object(
                            'hasData', true,
                            'method', 'avg',
                            'currentValue', ROUND(avg_time)::int,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'improvementRatePerDay', json_build_object(
                            'hasData', improvement_rate > 0,
                            'method', 'slope',
                            'currentValue', improvement_rate,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'perfectScoreCount', json_build_object(
                            'hasData', perfect_count > 0,
                            'method', 'sum',
                            'currentValue', perfect_count,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        ),
                        'quickestPassMinutes', json_build_object(
                            'hasData', quickest_pass > 0,
                            'method', 'min',
                            'currentValue', ROUND(quickest_pass)::int,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', '{}'::json
                        )
                    )
                ) ORDER BY highest_score DESC) FROM all_stats), '[]'::json)
            ) AS result
        """
        )

        return query, params
