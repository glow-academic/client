"""Base analytics query builder with common filtering logic."""

from typing import Any, List, Optional, Tuple


class AnalyticsFilters:
    """Common analytics filtering logic."""

    @staticmethod
    def build_base_filter(
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, List[Any]]:
        """
        Build base WHERE clause for analytics queries.
        
        Returns:
            Tuple of (where_clause, params_list)
        """
        conditions = []
        params: List[Any] = []
        param_counter = 1

        # Date filters
        conditions.append(f"a.attempt_created_at >= ${param_counter}")
        params.append(start_date)
        param_counter += 1
        
        conditions.append(f"a.attempt_created_at < ${param_counter}")
        params.append(end_date)
        param_counter += 1

        # Simulation type filters
        sim_filters = sim_filters or ["general"]
        sim_conditions = []
        
        if "general" in sim_filters:
            sim_conditions.append("a.is_general = TRUE")
        if "practice" in sim_filters:
            sim_conditions.append("a.is_practice = TRUE")
        if "archived" in sim_filters:
            if "general" not in sim_filters and "practice" not in sim_filters:
                sim_conditions.append("a.is_archived = TRUE")
            else:
                sim_conditions.append(
                    "(a.is_archived = TRUE OR (a.is_general = FALSE AND a.is_practice = FALSE))"
                )

        if sim_conditions:
            conditions.append(f"({' OR '.join(sim_conditions)})")

        # Profile filter
        if profile_id:
            conditions.append(f"a.profile_id = ${param_counter}")
            params.append(profile_id)
            param_counter += 1

        # Role filter (only if no profile_id)
        if not profile_id and roles:
            conditions.append(f"a.profile_role = ANY(${param_counter})")
            params.append(roles)
            param_counter += 1

        # Cohort filter
        if cohort_ids:
            conditions.append(f"(a.cohort_ids && ${param_counter} OR a.profile_cohort_ids && ${param_counter})")
            params.append(cohort_ids)
            param_counter += 1

        # Department filter
        if department_ids:
            conditions.append(f"a.department_id = ANY(${param_counter})")
            params.append(department_ids)
            param_counter += 1

        where_clause = " AND ".join(conditions) if conditions else "TRUE"
        return where_clause, params


class MetricQueryBuilder:
    """Base class for building metric queries."""

    @staticmethod
    def build_trend_query(
        metric_expression: str,
        aggregate_func: str,
        where_clause: str,
        group_by_date: bool = True,
    ) -> str:
        """
        Build trend data query.
        
        Args:
            metric_expression: SQL expression for the metric (e.g., "grade_percent")
            aggregate_func: Aggregation function (e.g., "AVG", "SUM")
            where_clause: WHERE clause string
            group_by_date: Whether to group by date
        """
        if group_by_date:
            return f"""
                SELECT
                    to_char(a.attempt_created_at, 'YYYY-MM-DD') AS date,
                    {aggregate_func}({metric_expression})::float AS value,
                    COUNT(*)::int AS count
                FROM analytics a
                WHERE {where_clause}
                GROUP BY date
                ORDER BY date
            """
        else:
            return f"""
                SELECT
                    {aggregate_func}({metric_expression})::float AS value,
                    COUNT(*)::int AS count
                FROM analytics a
                WHERE {where_clause}
            """

    @staticmethod
    def build_data_points_query(
        metric_expression: str,
        where_clause: str,
        include_simulation: bool = True,
        include_scenario: bool = True,
    ) -> str:
        """Build data points query for individual records."""
        fields = [
            "a.profile_id::text AS profile_id",
            "to_char(a.attempt_created_at, 'YYYY-MM-DD') AS date",
            f"{metric_expression} AS value",
        ]

        if include_simulation:
            fields.append("a.simulation_id::text AS simulation_id")
        if include_scenario:
            fields.append("a.scenario_id::text AS scenario_id")

        fields_str = ",\n            ".join(fields)

        return f"""
            SELECT
                {fields_str}
            FROM analytics a
            WHERE {where_clause}
            ORDER BY a.profile_id, a.attempt_created_at
        """


class AttemptNormalization:
    """Helpers for attempt-level normalization."""

    @staticmethod
    def build_normalized_score_cte(where_clause: str) -> str:
        """
        Build CTE for normalized attempt scores.
        
        This matches the logic from the stored procedures where scores are
        normalized by the expected scenario count.
        """
        return f"""
            WITH filt AS (
                SELECT * FROM analytics a
                WHERE {where_clause}
            ),
            per_attempt AS (
                SELECT
                    attempt_id,
                    MIN(attempt_created_at) AS attempt_created_at,
                    COALESCE(MAX(sim_scenario_count), 0) AS expected_from_sim,
                    COUNT(*) FILTER (WHERE completed) AS completed_chats,
                    COUNT(*) FILTER (WHERE completed AND grade_percent IS NOT NULL) AS graded_chats,
                    COUNT(*) AS chats_in_attempt,
                    SUM(grade_percent) FILTER (WHERE grade_percent IS NOT NULL) AS sum_grade_percent
                FROM filt
                GROUP BY attempt_id
            ),
            attempt_norm AS (
                SELECT
                    attempt_id,
                    attempt_created_at,
                    GREATEST(expected_from_sim, chats_in_attempt) AS expected,
                    completed_chats,
                    graded_chats,
                    CASE
                        WHEN GREATEST(expected_from_sim, chats_in_attempt) > 0 
                             AND completed_chats > 0 
                             AND completed_chats = graded_chats
                        THEN (sum_grade_percent / GREATEST(expected_from_sim, chats_in_attempt))
                        ELSE NULL
                    END AS norm
                FROM per_attempt
            )
        """


class AnalyticsQueryBuilder:
    """Main query builder for analytics."""

    def __init__(self) -> None:
        self.filters = AnalyticsFilters()
        self.metric_builder = MetricQueryBuilder()
        self.normalization = AttemptNormalization()

    def build_metric_query(
        self,
        metric_expression: str,
        aggregate_func: str,
        method: str,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
        use_normalization: bool = False,
        value_field: Optional[str] = None,
        key_field: Optional[str] = None,
    ) -> Tuple[str, List[Any]]:
        """
        Build a complete metric query with trend data and data points.
        
        Args:
            metric_expression: SQL expression for the metric
            aggregate_func: Aggregation function (AVG, SUM, etc.)
            method: Method name for response (avg, max, sum, rate, etc.)
            use_normalization: Whether to use attempt normalization
            value_field: Optional value field for response
            key_field: Optional key field for response
        """
        where_clause, params, param_counter = self.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        if use_normalization:
            # Use attempt normalization for scores
            norm_cte = self.normalization.build_normalized_score_cte(where_clause)
            query = f"""
                {norm_cte},
                by_day AS (
                    SELECT
                        to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                        {aggregate_func}(norm)::float AS value,
                        COUNT(*)::int AS count
                    FROM attempt_norm
                    WHERE norm IS NOT NULL
                    GROUP BY date
                    ORDER BY date
                ),
                cur AS (
                    SELECT
                        ROUND({aggregate_func}(norm))::int AS current_value,
                        COUNT(*) > 0 AS has_data
                    FROM attempt_norm
                    WHERE norm IS NOT NULL
                ),
                data_points AS (
                    SELECT
                        f.profile_id::text AS profile_id,
                        to_char(an.attempt_created_at, 'YYYY-MM-DD') AS date,
                        an.norm AS value,
                        f.simulation_id::text AS simulation_id,
                        f.scenario_id::text AS scenario_id
                    FROM attempt_norm an
                    JOIN filt f ON f.attempt_id = an.attempt_id
                    WHERE an.norm IS NOT NULL
                    ORDER BY f.profile_id, an.attempt_created_at
                )
                SELECT
                    COALESCE((SELECT has_data FROM cur), FALSE) AS has_data,
                    '{method}' AS method,
                    {f"'{value_field}'" if value_field else 'NULL'} AS value_field,
                    {f"'{key_field}'" if key_field else 'NULL'} AS key_field,
                    COALESCE((SELECT json_agg(json_build_object(
                        'date', date,
                        'value', ROUND(value)::int,
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
        else:
            # Standard query without normalization
            trend_query = self.metric_builder.build_trend_query(
                metric_expression, aggregate_func, where_clause
            )
            data_points_query = self.metric_builder.build_data_points_query(
                metric_expression, where_clause
            )

            query = f"""
                WITH by_day AS (
                    {trend_query}
                ),
                cur AS (
                    SELECT
                        ROUND({aggregate_func}({metric_expression}))::int AS current_value,
                        COUNT(*) > 0 AS has_data
                    FROM analytics a
                    WHERE {where_clause}
                ),
                data_points AS (
                    {data_points_query}
                )
                SELECT
                    COALESCE((SELECT has_data FROM cur), FALSE) AS has_data,
                    '{method}' AS method,
                    {f"'{value_field}'" if value_field else 'NULL'} AS value_field,
                    {f"'{key_field}'" if key_field else 'NULL'} AS key_field,
                    COALESCE((SELECT json_agg(json_build_object(
                        'date', date,
                        'value', ROUND(value)::int,
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
