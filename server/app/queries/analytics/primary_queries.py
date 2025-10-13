"""Primary analytics queries - 3 complex metrics."""

from typing import Any, Dict, List, Optional, Tuple

from app.queries.analytics.base import AnalyticsQueryBuilder


class PrimaryQueries:
    """Query builders for primary analytics metrics."""

    def __init__(self) -> None:
        self.builder = AnalyticsQueryBuilder()

    def growth_data(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """Build growth data query - aggregates multiple metrics over time."""
        where_clause, params = self.builder.filters.build_base_filter(
            start_date,
            end_date,
            cohort_ids,
            roles,
            sim_filters,
            profile_id,
            department_ids,
        )

        # This query calls other metric functions and combines them
        # For now, we'll build a simplified version that fetches from analytics directly
        query = f"""
            WITH
            spine AS (
                SELECT generate_series(
                    date_trunc('day', :start_date::timestamptz)::date,
                    (date_trunc('day', :end_date::timestamptz) - interval '1 second')::date,
                    interval '1 day'
                )::date AS d
            ),
            filt AS (
                SELECT * FROM analytics a WHERE {where_clause}
            ),
            -- Average Score per day
            avg_score AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    AVG(grade_percent)::float AS value
                FROM filt
                WHERE grade_percent IS NOT NULL
                GROUP BY date
            ),
            -- Pass Rate per day (first attempts only)
            pass_rate AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    (100.0 * COUNT(*) FILTER (WHERE grade_percent >= pass_percent) / NULLIF(COUNT(*), 0))::float AS value
                FROM (
                    SELECT DISTINCT ON (simulation_id, profile_id)
                        attempt_created_at, grade_percent, pass_percent
                    FROM filt
                    ORDER BY simulation_id, profile_id, attempt_created_at
                ) first_attempts
                GROUP BY date
            ),
            -- Combined chart data
            chart_data AS (
                SELECT
                    s.d::text AS date,
                    ROUND(COALESCE(avg_score.value, 0))::int AS average_score,
                    ROUND(COALESCE(pass_rate.value, 0))::int AS pass_rate
                FROM spine s
                LEFT JOIN avg_score ON avg_score.date = to_char(s.d, 'YYYY-MM-DD')
                LEFT JOIN pass_rate ON pass_rate.date = to_char(s.d, 'YYYY-MM-DD')
                ORDER BY s.d
            ),
            -- Window averages for actionable insights
            window_data AS (
                SELECT
                    AVG(average_score) FILTER (WHERE date >= (SELECT MAX(date) FROM chart_data) - interval '7 days') AS last_avg,
                    AVG(average_score) FILTER (WHERE date >= (SELECT MAX(date) FROM chart_data) - interval '14 days' 
                                                     AND date < (SELECT MAX(date) FROM chart_data) - interval '7 days') AS prev_avg
                FROM chart_data
            )
            SELECT json_build_object(
                'chartData', COALESCE((SELECT json_agg(json_build_object(
                    'date', date,
                    'averageScore', average_score,
                    'passRate', pass_rate
                ) ORDER BY date) FROM chart_data), '[]'::json),
                'availableMetrics', '[]'::json,
                'windowAverages', json_build_object(
                    'averageScore', json_build_object(
                        'n', 7,
                        'last', (SELECT ROUND(last_avg) FROM window_data),
                        'prev', (SELECT ROUND(prev_avg) FROM window_data)
                    )
                )
            ) AS result
        """

        return query, params

    def persona_performance(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """Build persona performance query."""
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
            persona_data AS (
                SELECT
                    persona_name,
                    persona_id,
                    persona_color,
                    AVG(grade_percent)::float AS avg_score,
                    COUNT(DISTINCT chat_id)::int AS sessions,
                    ARRAY_AGG(DISTINCT simulation_id::text) AS simulation_ids,
                    json_agg(json_build_object(
                        'date', to_char(chat_created_at, 'YYYY-MM-DD'),
                        'score', grade_percent,
                        'timestamp', EXTRACT(epoch FROM chat_created_at)::bigint,
                        'simulationId', simulation_id::text
                    ) ORDER BY chat_created_at) AS trend_data
                FROM filt
                WHERE persona_id IS NOT NULL
                  AND persona_name IS NOT NULL
                  AND grade_percent IS NOT NULL
                GROUP BY persona_name, persona_id, persona_color
            ),
            persona_colors AS (
                SELECT json_object_agg(
                    persona_id::text,
                    COALESCE(persona_color, '#6366f1')
                ) AS colors
                FROM (SELECT DISTINCT persona_id, persona_color FROM persona_data) p
            )
            SELECT json_build_object(
                'chartData', COALESCE((SELECT json_agg(json_build_object(
                    'name', persona_name,
                    'score', ROUND(avg_score)::int,
                    'sessions', sessions,
                    'color', COALESCE(persona_color, '#6366f1'),
                    'simulationIds', simulation_ids,
                    'trendData', trend_data
                ) ORDER BY avg_score DESC) FROM persona_data), '[]'::json),
                'validSimulationIds', COALESCE((
                    SELECT json_agg(DISTINCT simulation_id::text) 
                    FROM filt WHERE simulation_id IS NOT NULL
                ), '[]'::json),
                'personaColors', COALESCE((SELECT colors FROM persona_colors), '{}'::json)
            ) AS result
        """

        return query, params

    def rubric_heatmap(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """Build rubric heatmap query - correlation matrix of standard groups."""
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
            -- Get rubric IDs from filtered data
            rubric_ids AS (
                SELECT DISTINCT rubric_id
                FROM filt
                WHERE rubric_id IS NOT NULL
            ),
            -- Get standard groups per rubric
            standard_groups AS (
                SELECT
                    sg.id,
                    sg.name,
                    sg.short_name,
                    sg.rubric_id
                FROM rubric_standard_groups sg
                WHERE sg.rubric_id IN (SELECT rubric_id FROM rubric_ids)
                ORDER BY sg.rubric_id, sg.order_index
            ),
            -- Build empty matrix structure
            matrix_structure AS (
                SELECT
                    r.rubric_id,
                    json_agg(json_build_object(
                        'id', sg.id::text,
                        'name', sg.name,
                        'shortName', sg.short_name,
                        'rubricId', sg.rubric_id::text
                    ) ORDER BY sg.order_index) AS standard_groups
                FROM rubric_ids r
                JOIN standard_groups sg ON sg.rubric_id = r.rubric_id
                GROUP BY r.rubric_id
            )
            SELECT json_build_object(
                'matrices', COALESCE((SELECT json_agg(json_build_object(
                    'rubricId', rubric_id::text,
                    'standardGroups', standard_groups,
                    'matrix', '[]'::json,
                    'insights', NULL,
                    'hasData', false
                )) FROM matrix_structure), '[]'::json),
                'validRubricIds', COALESCE((
                    SELECT json_agg(rubric_id::text) FROM rubric_ids
                ), '[]'::json)
            ) AS result
        """

        return query, params

