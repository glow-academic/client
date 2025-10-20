"""Base service class with caching decorator support."""

from collections.abc import Awaitable, Callable
from datetime import datetime
from functools import wraps
from typing import Any, TypeVar

import asyncpg  # type: ignore
from app.cache.keys import Key
from app.db import get_pool
from app.extensions import get_query_client

T = TypeVar("T")


def with_cache(
    cache_key_func: Callable[..., Key],
    fresh_ttl: int = 30,
    stale_ttl: int = 300,
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    """
    Decorator to add caching to service methods.

    This eliminates the repetitive cache-check-and-fetch pattern that appears
    in every cached method across services.

    The decorator handles:
    - Cache availability check
    - Direct execution if no cache
    - Pool-aware fetcher creation for background refresh
    - Proper connection management for asyncpg

    Args:
        cache_key_func: Function that takes (self, *args, **kwargs) and returns a Key
        fresh_ttl: Seconds to consider data fresh
        stale_ttl: Seconds to serve stale data (with background refresh)

    Usage:
        @with_cache(lambda self, filters: keys.cohort_list(filters))
        async def get_cohorts_list(self, filters: CohortsFilters):
            # Method implementation - executes directly if no cache,
            # or used as fetcher for background refresh if cached
            ...
    """

    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        @wraps(func)
        async def wrapper(self: "BaseService", *args: Any, **kwargs: Any) -> Any:
            qc = get_query_client()

            # No cache available - execute directly with request connection
            if not qc:
                return await func(self, *args, **kwargs)

            # Get cache key
            key = cache_key_func(self, *args, **kwargs)

            # Create pool-aware fetcher for background refresh
            # This is critical: asyncpg connections can only handle one operation at a time,
            # so background refresh must acquire its own connection from the pool
            async def fetcher() -> T:
                pool = get_pool()
                if not pool:
                    # Fallback to direct execution if pool unavailable
                    return await func(self, *args, **kwargs)

                # Acquire new connection from pool for background refresh
                async with pool.acquire() as conn:
                    # Create temporary service instance with new connection
                    temp_service = self.__class__(conn)

                    # Copy query object attributes (but NOT nested service instances)
                    # This transfers query builders like self.queries, self.staff_queries, etc.
                    for attr_name, attr_value in self.__dict__.items():
                        if attr_name == "conn":
                            # Skip connection - already set in temp_service.__init__
                            continue
                        if attr_name.endswith("_queries") or attr_name == "queries":
                            # Copy query builder instances
                            setattr(temp_service, attr_name, attr_value)
                        # Skip everything else (especially service instances - anti-pattern)

                    # Execute method with temp service instance
                    return await func(temp_service, *args, **kwargs)

            # Query cache with fetcher
            return await qc.query(
                key,
                fetcher,
                tags=list(key.tags()),
                fresh_ttl=fresh_ttl,
                stale_ttl=stale_ttl,
            )

        return wrapper

    return decorator


class BaseService:
    """
    Base service class with database connection.

    All services should inherit from this class to ensure consistent
    connection handling and access to caching decorators.

    Attributes:
        conn: asyncpg database connection for this service instance
    """

    def __init__(self, conn: asyncpg.Connection):
        """
        Initialize service with database connection.

        Args:
            conn: asyncpg connection from the request or pool
        """
        self.conn = conn

    async def _invalidate_cache(self, tags: list[str]) -> None:
        """
        Invalidate cache tags if cache is available.

        This is a convenience wrapper to eliminate repetitive cache availability checks.
        Safe to call even if cache is disabled - will silently skip invalidation.

        Args:
            tags: List of cache tag strings to invalidate

        Example:
            await self._invalidate_cache([
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
            ])
        """
        qc = get_query_client()
        if qc:
            await qc.invalidate(tags=tags)


# ===== Analytics Query Builder Utilities =====


class AnalyticsFilters:
    """Common analytics filtering logic."""

    @staticmethod
    def build_base_filter(
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """
        Build base WHERE clause for analytics queries.

        Returns:
            Tuple of (where_clause, params_list)
        """
        conditions = []
        params: list[Any] = []
        param_counter = 1

        # Date filters - convert ISO strings to datetime objects
        conditions.append(f"a.attempt_created_at >= ${param_counter}")
        params.append(datetime.fromisoformat(start_date.replace("Z", "+00:00")))
        param_counter += 1

        conditions.append(f"a.attempt_created_at < ${param_counter}")
        params.append(datetime.fromisoformat(end_date.replace("Z", "+00:00")))
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
            conditions.append(
                f"(a.cohort_ids && ${param_counter} OR a.profile_cohort_ids && ${param_counter})"
            )
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
                    COALESCE({aggregate_func}({metric_expression}), 0)::float AS value,
                    COUNT(*)::int AS count
                FROM analytics a
                WHERE {where_clause}
                GROUP BY date
                ORDER BY date
            """
        else:
            return f"""
                SELECT
                    COALESCE({aggregate_func}({metric_expression}), 0)::float AS value,
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
            f"ROUND(COALESCE({metric_expression}, 0))::int AS value",
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
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
        use_normalization: bool = False,
        value_field: str | None = None,
        key_field: str | None = None,
    ) -> tuple[str, list[Any]]:
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
        where_clause, params = self.filters.build_base_filter(
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
                        ROUND(COALESCE(an.norm, 0))::int AS value,
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
                    COALESCE((SELECT current_value FROM cur), 0) AS current_value,
                    {f"'{value_field}'" if value_field else "NULL"} AS value_field,
                    {f"'{key_field}'" if key_field else "NULL"} AS key_field,
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
                        ROUND(COALESCE({aggregate_func}({metric_expression}), 0))::int AS current_value,
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
                    COALESCE((SELECT current_value FROM cur), 0) AS current_value,
                    {f"'{value_field}'" if value_field else "NULL"} AS value_field,
                    {f"'{key_field}'" if key_field else "NULL"} AS key_field,
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

    def get_profile_role(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query to get profile role."""
        query = "SELECT role FROM profiles WHERE id = $1"
        return (query, [profile_id])

    # ===== Entity mapping queries for analytics =====

    def get_scenarios_for_mapping(
        self, department_ids: list[str] | None
    ) -> tuple[str, list[Any]]:
        """Build query to get scenarios for mapping."""
        query = """
        SELECT DISTINCT s.id, s.name, s.problem_statement
        FROM scenarios s
        WHERE ($1::uuid[] IS NULL OR s.department_id = ANY($1::uuid[]))
        AND s.active = true
        """
        return (query, [department_ids])

    def get_simulations_for_mapping(
        self, department_ids: list[str] | None
    ) -> tuple[str, list[Any]]:
        """Build query to get practice simulations for mapping."""
        query = """
        SELECT DISTINCT s.id, s.title, s.description
        FROM simulations s
        WHERE ($1::uuid[] IS NULL OR s.department_id = ANY($1::uuid[]))
        AND s.active = true
        AND s.practice_simulation = true
        """
        return (query, [department_ids])

    def get_rubrics_for_mapping(
        self, department_ids: list[str] | None
    ) -> tuple[str, list[Any]]:
        """Build query to get rubrics for mapping."""
        query = """
        SELECT DISTINCT r.id, r.name, r.description
        FROM rubrics r
        WHERE ($1::uuid[] IS NULL OR r.department_id = ANY($1::uuid[]))
        AND r.active = true
        """
        return (query, [department_ids])

    def get_parameters_for_mapping(
        self, department_ids: list[str] | None
    ) -> tuple[str, list[Any]]:
        """Build query to get non-default parameters for mapping."""
        query = """
        SELECT DISTINCT p.id, p.name, p.description
        FROM parameters p
        WHERE ($1::uuid[] IS NULL OR p.department_id = ANY($1::uuid[]))
        AND p.active = true
        AND p.default_parameter = false
        """
        return (query, [department_ids])

    def get_parameter_items_for_mapping(
        self, department_ids: list[str] | None
    ) -> tuple[str, list[Any]]:
        """Build query to get default parameter items for non-default parameters."""
        query = """
        SELECT DISTINCT pi.id, pi.name, pi.description, pi.parameter_id, p.name as parameter_name
        FROM parameter_items pi
        JOIN parameters p ON pi.parameter_id = p.id
        WHERE ($1::uuid[] IS NULL OR p.department_id = ANY($1::uuid[]))
        AND p.active = true
        AND p.default_parameter = false
        AND pi.default_item = true
        """
        return (query, [department_ids])

    def get_personas_for_mapping(
        self, department_ids: list[str] | None
    ) -> tuple[str, list[Any]]:
        """Build query to get personas for mapping."""
        query = """
        SELECT DISTINCT p.id, p.name, p.description, p.color, p.icon
        FROM personas p
        WHERE ($1::uuid[] IS NULL OR p.department_id = ANY($1::uuid[]))
        AND p.active = true
        """
        return (query, [department_ids])
