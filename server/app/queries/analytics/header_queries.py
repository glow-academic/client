"""Header analytics queries - 10 metrics."""

from typing import Any

from app.queries.analytics.base import AnalyticsQueryBuilder


class HeaderQueries:
    """Query builders for header analytics metrics."""

    def __init__(self) -> None:
        self.builder = AnalyticsQueryBuilder()

    def average_score(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build average score query."""
        return self.builder.build_metric_query(
            metric_expression="grade_percent",
            aggregate_func="AVG",
            method="avg",
            start_date=start_date,
            end_date=end_date,
            cohort_ids=cohort_ids,
            roles=roles,
            sim_filters=sim_filters,
            profile_id=profile_id,
            department_ids=department_ids,
            use_normalization=True,  # Use attempt normalization
        )

    def completion_percentage(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build completion percentage query."""
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
            per_attempt AS (
                SELECT
                    attempt_id,
                    MIN(attempt_created_at) AS attempt_created_at,
                    COALESCE(MAX(sim_scenario_count), 0) AS expected,
                    COUNT(*) FILTER (WHERE completed) AS completed_count
                FROM filt
                GROUP BY attempt_id
            ),
            with_pct AS (
                SELECT
                    attempt_id,
                    attempt_created_at,
                    CASE
                        WHEN expected > 0 THEN (100.0 * completed_count / expected)
                        ELSE 0
                    END AS completion_pct
                FROM per_attempt
            ),
            by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    AVG(completion_pct)::float AS value,
                    COUNT(*)::int AS count
                FROM with_pct
                GROUP BY date
                ORDER BY date
            ),
            data_points AS (
                SELECT
                    f.profile_id::text AS profile_id,
                    to_char(wp.attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(wp.completion_pct)::int AS value,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM with_pct wp
                JOIN filt f ON f.attempt_id = wp.attempt_id
                ORDER BY f.profile_id, wp.attempt_created_at
            )
            SELECT
                (SELECT COUNT(*) > 0 FROM with_pct) AS has_data,
                'rate' AS method,
                COALESCE((SELECT ROUND(AVG(completion_pct))::int FROM with_pct), 0) AS current_value,
                NULL AS value_field,
                NULL AS key_field,
                COALESCE((SELECT json_agg(json_build_object(
                    'date', date,
                    'value', ROUND(COALESCE(value, 0))::int,
                    'count', count
                ) ORDER BY date) FROM by_day), '[]'::json) AS trend_data,
                COALESCE((SELECT json_agg(json_build_object(
                    'profileId', profile_id,
                    'date', date,
                    'value', value,
                    'simulationId', simulation_id,
                    'scenarioId', scenario_id
                ) ORDER BY profile_id, date) FROM data_points), '[]'::json) AS data_points
        """

        return query, params

    def first_attempt_pass_rate(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build first attempt pass rate query."""
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
            first_attempts AS (
                SELECT DISTINCT ON (simulation_id, profile_id)
                    attempt_id,
                    attempt_created_at,
                    simulation_id,
                    profile_id,
                    grade_percent >= (rubric_pass_points * 100.0 / NULLIF(rubric_points, 0)) AS passed
                FROM filt
                ORDER BY simulation_id, profile_id, attempt_created_at
            ),
            by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    (100.0 * COUNT(*) FILTER (WHERE passed) / NULLIF(COUNT(*), 0))::float AS value,
                    COUNT(*)::int AS count
                FROM first_attempts
                GROUP BY date
                ORDER BY date
            ),
            data_points AS (
                SELECT
                    profile_id::text,
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    CASE WHEN passed THEN 100 ELSE 0 END AS value,
                    simulation_id::text,
                    attempt_id::text
                FROM first_attempts
                ORDER BY profile_id, attempt_created_at
            )
            SELECT
                (SELECT COUNT(*) > 0 FROM first_attempts) AS has_data,
                'rate' AS method,
                COALESCE((SELECT ROUND((100.0 * COUNT(*) FILTER (WHERE passed) / NULLIF(COUNT(*), 0)))::int FROM first_attempts), 0) AS current_value,
                NULL AS value_field,
                NULL AS key_field,
                COALESCE((SELECT json_agg(json_build_object(
                    'date', date,
                    'value', ROUND(COALESCE(value, 0))::int,
                    'count', count
                ) ORDER BY date) FROM by_day), '[]'::json) AS trend_data,
                COALESCE((SELECT json_agg(json_build_object(
                    'profileId', profile_id,
                    'date', date,
                    'value', value,
                    'simulationId', simulation_id,
                    'attemptId', attempt_id
                ) ORDER BY profile_id, date) FROM data_points), '[]'::json) AS data_points
        """

        return query, params

    def highest_score(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build highest score query."""
        return self.builder.build_metric_query(
            metric_expression="grade_percent",
            aggregate_func="MAX",
            method="max",
            start_date=start_date,
            end_date=end_date,
            cohort_ids=cohort_ids,
            roles=roles,
            sim_filters=sim_filters,
            profile_id=profile_id,
            department_ids=department_ids,
            use_normalization=True,
        )

    def messages_per_session(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build messages per session query."""
        return self.builder.build_metric_query(
            metric_expression="num_messages_total",
            aggregate_func="AVG",
            method="avg",
            start_date=start_date,
            end_date=end_date,
            cohort_ids=cohort_ids,
            roles=roles,
            sim_filters=sim_filters,
            profile_id=profile_id,
            department_ids=department_ids,
        )

    def persona_response_times(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build persona response times query."""
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
            with_deltas AS (
                SELECT
                    a.*,
                    UNNEST(a.message_time_taken_seconds) AS delta_sec
                FROM filt a
                WHERE cardinality(a.message_time_taken_seconds) > 0
            ),
            by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    AVG(delta_sec)::float AS value,
                    COUNT(*)::int AS count
                FROM with_deltas
                GROUP BY date
                ORDER BY date
            ),
            data_points AS (
                SELECT
                    profile_id::text,
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(delta_sec)::int AS value,
                    simulation_id::text,
                    scenario_id::text
                FROM with_deltas
                ORDER BY profile_id, attempt_created_at
            )
            SELECT
                (SELECT COUNT(*) > 0 FROM with_deltas) AS has_data,
                'avg' AS method,
                COALESCE((SELECT ROUND(AVG(delta_sec))::int FROM with_deltas), 0) AS current_value,
                NULL AS value_field,
                NULL AS key_field,
                COALESCE((SELECT json_agg(json_build_object(
                    'date', date,
                    'value', ROUND(COALESCE(value, 0))::int,
                    'count', count
                ) ORDER BY date) FROM by_day), '[]'::json) AS trend_data,
                COALESCE((SELECT json_agg(json_build_object(
                    'profileId', profile_id,
                    'date', date,
                    'value', value,
                    'simulationId', simulation_id,
                    'scenarioId', scenario_id
                ) ORDER BY profile_id, date) FROM data_points), '[]'::json) AS data_points
        """

        return query, params

    def session_efficiency(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build session efficiency query (score / time ratio)."""
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
                SELECT * FROM analytics a
                WHERE {where_clause}
                  AND time_taken_seconds > 0
                  AND grade_percent IS NOT NULL
            ),
            with_eff AS (
                SELECT
                    *,
                    (grade_percent / NULLIF(time_taken_seconds / 60.0, 0))::float AS efficiency
                FROM filt
            ),
            by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    AVG(efficiency)::float AS value,
                    COUNT(*)::int AS count
                FROM with_eff
                GROUP BY date
                ORDER BY date
            ),
            data_points AS (
                SELECT
                    profile_id::text,
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(efficiency)::int AS value,
                    simulation_id::text,
                    scenario_id::text
                FROM with_eff
                ORDER BY profile_id, attempt_created_at
            )
            SELECT
                (SELECT COUNT(*) > 0 FROM with_eff) AS has_data,
                'avg' AS method,
                COALESCE((SELECT ROUND(AVG(efficiency))::int FROM with_eff), 0) AS current_value,
                NULL AS value_field,
                NULL AS key_field,
                COALESCE((SELECT json_agg(json_build_object(
                    'date', date,
                    'value', ROUND(COALESCE(value, 0))::int,
                    'count', count
                ) ORDER BY date) FROM by_day), '[]'::json) AS trend_data,
                COALESCE((SELECT json_agg(json_build_object(
                    'profileId', profile_id,
                    'date', date,
                    'value', value,
                    'simulationId', simulation_id,
                    'scenarioId', scenario_id
                ) ORDER BY profile_id, date) FROM data_points), '[]'::json) AS data_points
        """

        return query, params

    def stagnation_rate(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build stagnation rate query."""
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
            user_attempts AS (
                SELECT
                    simulation_id,
                    profile_id,
                    attempt_created_at,
                    grade_percent,
                    LAG(grade_percent) OVER (
                        PARTITION BY simulation_id, profile_id
                        ORDER BY attempt_created_at
                    ) AS prev_grade
                FROM filt
            ),
            stagnant_attempts AS (
                SELECT
                    *,
                    CASE
                        WHEN prev_grade IS NOT NULL AND grade_percent <= prev_grade
                        THEN 1 ELSE 0
                    END AS is_stagnant
                FROM user_attempts
                WHERE prev_grade IS NOT NULL
            ),
            by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    (100.0 * SUM(is_stagnant) / NULLIF(COUNT(*), 0))::float AS value,
                    COUNT(*)::int AS count
                FROM stagnant_attempts
                GROUP BY date
                ORDER BY date
            ),
            data_points AS (
                SELECT
                    profile_id::text,
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    (is_stagnant * 100) AS value,
                    simulation_id::text,
                    attempt_created_at::text AS attempt_id
                FROM stagnant_attempts
                ORDER BY profile_id, attempt_created_at
            )
            SELECT
                (SELECT COUNT(*) > 0 FROM stagnant_attempts) AS has_data,
                'rate' AS method,
                COALESCE((SELECT ROUND((100.0 * SUM(is_stagnant) / NULLIF(COUNT(*), 0)))::int FROM stagnant_attempts), 0) AS current_value,
                NULL AS value_field,
                NULL AS key_field,
                COALESCE((SELECT json_agg(json_build_object(
                    'date', date,
                    'value', ROUND(COALESCE(value, 0))::int,
                    'count', count
                ) ORDER BY date) FROM by_day), '[]'::json) AS trend_data,
                COALESCE((SELECT json_agg(json_build_object(
                    'profileId', profile_id,
                    'date', date,
                    'value', value,
                    'simulationId', simulation_id,
                    'attemptId', attempt_id
                ) ORDER BY profile_id, date) FROM data_points), '[]'::json) AS data_points
        """

        return query, params

    def time_spent(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build time spent query (in minutes)."""
        return self.builder.build_metric_query(
            metric_expression="(time_taken_seconds / 60.0)",
            aggregate_func="AVG",
            method="avg",
            start_date=start_date,
            end_date=end_date,
            cohort_ids=cohort_ids,
            roles=roles,
            sim_filters=sim_filters,
            profile_id=profile_id,
            department_ids=department_ids,
        )

    def total_attempts(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build total attempts query."""
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
            distinct_attempts AS (
                SELECT DISTINCT
                    attempt_id,
                    attempt_created_at,
                    profile_id,
                    simulation_id
                FROM filt
            ),
            by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    COUNT(*)::float AS value,
                    COUNT(*)::int AS count
                FROM distinct_attempts
                GROUP BY date
                ORDER BY date
            ),
            data_points AS (
                SELECT
                    profile_id::text,
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    1 AS value,
                    simulation_id::text,
                    attempt_id::text
                FROM distinct_attempts
                ORDER BY profile_id, attempt_created_at
            )
            SELECT
                (SELECT COUNT(*) > 0 FROM distinct_attempts) AS has_data,
                'countDistinct' AS method,
                COALESCE((SELECT COUNT(DISTINCT attempt_id)::int FROM distinct_attempts), 0) AS current_value,
                NULL AS value_field,
                'attemptId' AS key_field,
                COALESCE((SELECT json_agg(json_build_object(
                    'date', date,
                    'value', ROUND(COALESCE(value, 0))::int,
                    'count', count
                ) ORDER BY date) FROM by_day), '[]'::json) AS trend_data,
                COALESCE((SELECT json_agg(json_build_object(
                    'profileId', profile_id,
                    'date', date,
                    'value', value,
                    'simulationId', simulation_id,
                    'attemptId', attempt_id
                ) ORDER BY profile_id, date) FROM data_points), '[]'::json) AS data_points
        """

        return query, params

    def growth_data_bundle(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build bundled growth data query with all 9 metrics in one query."""
        where_clause, params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        # This query combines trend_data from 9 different metrics into a single result
        query = f"""
            WITH filt AS (
                SELECT * FROM analytics a WHERE {where_clause}
            ),
            -- Average Score (with normalization)
            per_attempt_score AS (
                SELECT
                    attempt_id,
                    MIN(attempt_created_at) AS attempt_created_at,
                    GREATEST(COALESCE(MAX(sim_scenario_count), 0), COUNT(*)) AS expected,
                    COUNT(*) FILTER (WHERE completed) AS completed_chats,
                    COUNT(*) FILTER (WHERE completed AND grade_percent IS NOT NULL) AS graded_chats,
                    SUM(grade_percent) FILTER (WHERE grade_percent IS NOT NULL) AS sum_grade_percent
                FROM filt
                GROUP BY attempt_id
            ),
            attempt_norm AS (
                SELECT
                    attempt_id,
                    attempt_created_at,
                    CASE
                        WHEN expected > 0 AND completed_chats > 0 AND completed_chats = graded_chats
                        THEN (sum_grade_percent / expected)
                        ELSE NULL
                    END AS norm
                FROM per_attempt_score
            ),
            avg_score_by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    AVG(norm)::float AS value
                FROM attempt_norm
                WHERE norm IS NOT NULL
                GROUP BY date
            ),
            -- Pass Rate (first attempt pass rate)
            first_attempts AS (
                SELECT DISTINCT ON (simulation_id, profile_id)
                    attempt_created_at,
                    grade_percent >= (rubric_pass_points * 100.0 / NULLIF(rubric_points, 0)) AS passed
                FROM filt
                ORDER BY simulation_id, profile_id, attempt_created_at
            ),
            pass_rate_by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    (100.0 * COUNT(*) FILTER (WHERE passed) / NULLIF(COUNT(*), 0))::float AS value
                FROM first_attempts
                GROUP BY date
            ),
            -- Completion Rate
            per_attempt_completion AS (
                SELECT
                    attempt_id,
                    MIN(attempt_created_at) AS attempt_created_at,
                    COALESCE(MAX(sim_scenario_count), 0) AS expected,
                    COUNT(*) FILTER (WHERE completed) AS completed_count
                FROM filt
                GROUP BY attempt_id
            ),
            with_completion_pct AS (
                SELECT
                    attempt_created_at,
                    CASE WHEN expected > 0 THEN (100.0 * completed_count / expected) ELSE 0 END AS completion_pct
                FROM per_attempt_completion
            ),
            completion_rate_by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    AVG(completion_pct)::float AS value
                FROM with_completion_pct
                GROUP BY date
            ),
            -- Messages Per Session
            messages_by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    AVG(num_messages_total)::float AS value
                FROM filt
                WHERE num_messages_total IS NOT NULL
                GROUP BY date
            ),
            -- Persona Response Times
            persona_times AS (
                SELECT
                    attempt_created_at,
                    UNNEST(message_time_taken_seconds) AS delta_sec
                FROM filt
                WHERE cardinality(message_time_taken_seconds) > 0
            ),
            persona_response_by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    AVG(delta_sec)::float AS value
                FROM persona_times
                GROUP BY date
            ),
            -- Session Efficiency
            efficiency_by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    AVG(grade_percent / NULLIF(time_taken_seconds / 60.0, 0))::float AS value
                FROM filt
                WHERE time_taken_seconds > 0 AND grade_percent IS NOT NULL
                GROUP BY date
            ),
            -- Stagnation Rate
            user_attempts AS (
                SELECT
                    attempt_created_at,
                    simulation_id,
                    profile_id,
                    grade_percent,
                    LAG(grade_percent) OVER (
                        PARTITION BY simulation_id, profile_id
                        ORDER BY attempt_created_at
                    ) AS prev_grade
                FROM filt
            ),
            stagnant_attempts AS (
                SELECT
                    attempt_created_at,
                    CASE
                        WHEN prev_grade IS NOT NULL AND grade_percent <= prev_grade
                        THEN 1 ELSE 0
                    END AS is_stagnant
                FROM user_attempts
                WHERE prev_grade IS NOT NULL
            ),
            stagnation_by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    (100.0 * SUM(is_stagnant) / NULLIF(COUNT(*), 0))::float AS value
                FROM stagnant_attempts
                GROUP BY date
            ),
            -- Time Spent
            time_spent_by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    AVG(time_taken_seconds / 60.0)::float AS value
                FROM filt
                WHERE time_taken_seconds IS NOT NULL
                GROUP BY date
            ),
            -- Total Attempts
            total_attempts_by_day AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    COUNT(DISTINCT attempt_id)::float AS value
                FROM filt
                GROUP BY date
            ),
            -- Collect all dates
            all_dates AS (
                SELECT DISTINCT date FROM (
                    SELECT date FROM avg_score_by_day
                    UNION SELECT date FROM pass_rate_by_day
                    UNION SELECT date FROM completion_rate_by_day
                    UNION SELECT date FROM messages_by_day
                    UNION SELECT date FROM persona_response_by_day
                    UNION SELECT date FROM efficiency_by_day
                    UNION SELECT date FROM stagnation_by_day
                    UNION SELECT date FROM time_spent_by_day
                    UNION SELECT date FROM total_attempts_by_day
                ) dates
            )
            SELECT jsonb_build_object(
                'averageScore', COALESCE(
                    (SELECT jsonb_agg(jsonb_build_object('date', date, 'value', ROUND(COALESCE(value, 0))::int) ORDER BY date)
                     FROM avg_score_by_day), '[]'::jsonb),
                'passRate', COALESCE(
                    (SELECT jsonb_agg(jsonb_build_object('date', date, 'value', ROUND(COALESCE(value, 0))::int) ORDER BY date)
                     FROM pass_rate_by_day), '[]'::jsonb),
                'completionRate', COALESCE(
                    (SELECT jsonb_agg(jsonb_build_object('date', date, 'value', ROUND(COALESCE(value, 0))::int) ORDER BY date)
                     FROM completion_rate_by_day), '[]'::jsonb),
                'messagesPerSession', COALESCE(
                    (SELECT jsonb_agg(jsonb_build_object('date', date, 'value', ROUND(COALESCE(value, 0))::int) ORDER BY date)
                     FROM messages_by_day), '[]'::jsonb),
                'personaResponseTimes', COALESCE(
                    (SELECT jsonb_agg(jsonb_build_object('date', date, 'value', ROUND(COALESCE(value, 0))::int) ORDER BY date)
                     FROM persona_response_by_day), '[]'::jsonb),
                'sessionEfficiency', COALESCE(
                    (SELECT jsonb_agg(jsonb_build_object('date', date, 'value', ROUND(COALESCE(value, 0))::int) ORDER BY date)
                     FROM efficiency_by_day), '[]'::jsonb),
                'stagnationRate', COALESCE(
                    (SELECT jsonb_agg(jsonb_build_object('date', date, 'value', ROUND(COALESCE(value, 0))::int) ORDER BY date)
                     FROM stagnation_by_day), '[]'::jsonb),
                'timeSpent', COALESCE(
                    (SELECT jsonb_agg(jsonb_build_object('date', date, 'value', ROUND(COALESCE(value, 0))::int) ORDER BY date)
                     FROM time_spent_by_day), '[]'::jsonb),
                'totalAttempts', COALESCE(
                    (SELECT jsonb_agg(jsonb_build_object('date', date, 'value', ROUND(COALESCE(value, 0))::int) ORDER BY date)
                     FROM total_attempts_by_day), '[]'::jsonb)
            ) as result
        """

        return query, params
