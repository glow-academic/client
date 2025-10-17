"""Primary analytics queries - 3 complex metrics."""

from typing import Any, List, Optional, Tuple

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
    ) -> Tuple[str, List[Any]]:
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

        # Reuse the first two parameters ($1, $2) for the spine since they're already the date range
        # This query calls other metric functions and combines them
        # For now, we'll build a simplified version that fetches from analytics directly
        query = f"""
            WITH
            spine AS (
                SELECT generate_series(
                    date_trunc('day', $1::timestamptz)::date,
                    (date_trunc('day', $2::timestamptz) - interval '1 second')::date,
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
                    (100.0 * COUNT(*) FILTER (WHERE grade_percent >= (rubric_pass_points * 100.0 / NULLIF(rubric_points, 0))) / NULLIF(COUNT(*), 0))::float AS value
                FROM (
                    SELECT DISTINCT ON (simulation_id, profile_id)
                        attempt_created_at, grade_percent, rubric_pass_points, rubric_points
                    FROM filt
                    ORDER BY simulation_id, profile_id, attempt_created_at
                ) first_attempts
                GROUP BY date
            ),
            -- Combined chart data (keep date as date for window calculations)
            chart_data_dates AS (
                SELECT
                    s.d AS date_val,
                    to_char(s.d, 'YYYY-MM-DD') AS date,
                    ROUND(COALESCE(avg_score.value, 0))::int AS average_score,
                    ROUND(COALESCE(pass_rate.value, 0))::int AS pass_rate
                FROM spine s
                LEFT JOIN avg_score ON avg_score.date = to_char(s.d, 'YYYY-MM-DD')
                LEFT JOIN pass_rate ON pass_rate.date = to_char(s.d, 'YYYY-MM-DD')
            ),
            -- Window averages for actionable insights
            window_data AS (
                SELECT
                    AVG(average_score) FILTER (WHERE date_val >= (SELECT MAX(date_val) FROM chart_data_dates) - interval '7 days') AS last_avg,
                    AVG(average_score) FILTER (WHERE date_val >= (SELECT MAX(date_val) FROM chart_data_dates) - interval '14 days' 
                                                     AND date_val < (SELECT MAX(date_val) FROM chart_data_dates) - interval '7 days') AS prev_avg
                FROM chart_data_dates
            ),
            chart_data AS (
                SELECT date, average_score, pass_rate
                FROM chart_data_dates
                ORDER BY date_val
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
    ) -> Tuple[str, List[Any]]:
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
            -- Get distinct persona IDs from filtered data
            persona_ids AS (
                SELECT DISTINCT persona_id
                FROM filt
                WHERE persona_id IS NOT NULL
            ),
            -- Join with personas table to get name and color
            personas_info AS (
                SELECT 
                    pi.persona_id, 
                    p.name, 
                    COALESCE(p.color, '#3b82f6') AS color
                FROM persona_ids pi
                JOIN personas p ON p.id = pi.persona_id
            ),
            -- Aggregate performance data per persona
            persona_data AS (
                SELECT
                    f.persona_id,
                    pinfo.name AS persona_name,
                    pinfo.color AS persona_color,
                    AVG(f.grade_percent)::float AS avg_score,
                    COUNT(DISTINCT f.chat_id)::int AS sessions,
                    ARRAY_AGG(DISTINCT f.simulation_id::text) AS simulation_ids
                FROM filt f
                JOIN personas_info pinfo ON pinfo.persona_id = f.persona_id
                WHERE f.grade_percent IS NOT NULL
                GROUP BY f.persona_id, pinfo.name, pinfo.color
            ),
            -- Build trend data per persona (compute averages first)
            trend_data_raw AS (
                SELECT
                    f.persona_id,
                    date_trunc('day', f.chat_created_at) AS day,
                    to_char(date_trunc('day', f.chat_created_at), 'YYYY-MM-DD') AS date,
                    EXTRACT(epoch FROM date_trunc('day', f.chat_created_at))::bigint AS timestamp,
                    f.simulation_id,
                    AVG(f.grade_percent)::float AS avg_score
                FROM filt f
                WHERE f.persona_id IS NOT NULL
                  AND f.grade_percent IS NOT NULL
                GROUP BY f.persona_id, date_trunc('day', f.chat_created_at), f.simulation_id
            ),
            -- Aggregate into JSON per persona
            persona_trends AS (
                SELECT 
                    persona_id,
                    COALESCE(json_agg(json_build_object(
                        'date', date,
                        'score', ROUND(avg_score)::int,
                        'timestamp', timestamp,
                        'simulationId', simulation_id::text
                    ) ORDER BY day), '[]'::json) AS trend_data
                FROM trend_data_raw
                GROUP BY persona_id
            ),
            persona_colors AS (
                SELECT json_object_agg(
                    persona_name,
                    persona_color
                ) AS colors
                FROM (SELECT DISTINCT persona_name, persona_color FROM persona_data) p
            )
            SELECT json_build_object(
                'chartData', COALESCE((
                    SELECT json_agg(json_build_object(
                        'name', pd.persona_name,
                        'score', ROUND(pd.avg_score)::int,
                        'sessions', pd.sessions,
                        'color', pd.persona_color,
                        'simulationIds', pd.simulation_ids,
                        'trendData', COALESCE(pt.trend_data, '[]'::json)
                    ) ORDER BY pd.avg_score DESC)
                    FROM persona_data pd
                    LEFT JOIN persona_trends pt ON pt.persona_id = pd.persona_id
                ), '[]'::json),
                'validSimulationIds', COALESCE((
                    SELECT json_agg(DISTINCT simulation_id::text ORDER BY simulation_id::text) 
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
    ) -> Tuple[str, List[Any]]:
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
                FROM standard_groups sg
                WHERE sg.rubric_id IN (SELECT rubric_id FROM rubric_ids)
            ),
            -- Build empty matrix structure
            matrix_structure AS (
                SELECT
                    r.rubric_id,
                    COALESCE(json_agg(json_build_object(
                        'id', sg.id::text,
                        'name', sg.name,
                        'shortName', sg.short_name,
                        'rubricId', sg.rubric_id::text
                    ) ORDER BY sg.name), '[]'::json) AS standard_groups
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

