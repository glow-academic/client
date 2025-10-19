"""Primary analytics queries - 3 complex metrics."""

from typing import Any

from app.queries.analytics.base import AnalyticsQueryBuilder


class PrimaryQueries:
    """Query builders for primary analytics metrics."""

    def __init__(self) -> None:
        self.builder = AnalyticsQueryBuilder()

    def growth_data(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
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
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
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

        query = (
            """
            WITH filt AS (
                SELECT * FROM analytics a WHERE """
            + where_clause
            + """
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
                        'score', ROUND(COALESCE(avg_score, 0))::int,
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
                        'score', ROUND(COALESCE(pd.avg_score, 0))::int,
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
        )

        return query, params

    def rubric_heatmap(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
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

        query = (
            """
            WITH filt AS (
                SELECT * FROM analytics a WHERE """
            + where_clause
            + """
            ),
            -- Get distinct chat IDs from filtered data
            filtered_chats AS (
                SELECT DISTINCT chat_id
                FROM filt
                WHERE chat_id IS NOT NULL
            ),
            -- Get latest grade per chat
            latest_grade_per_chat AS (
                SELECT DISTINCT ON (scg.simulation_chat_id)
                    scg.id,
                    scg.simulation_chat_id AS chat_id,
                    scg.rubric_id
                FROM simulation_chat_grades scg
                JOIN filtered_chats fc ON fc.chat_id = scg.simulation_chat_id
                ORDER BY scg.simulation_chat_id, scg.created_at DESC
            ),
            -- Aggregate feedback into per-(chat, rubric, group) percentages
            per_grade_group AS (
                SELECT
                    lg.chat_id,
                    sg.rubric_id,
                    sg.id AS group_id,
                    sg.name AS group_name,
                    (100.0 * SUM(scf.total)::float8 / NULLIF(sg.points::float8, 0))::float8 AS pct
                FROM latest_grade_per_chat lg
                JOIN simulation_chat_feedbacks scf ON scf.simulation_chat_grade_id = lg.id
                JOIN standards s ON s.id = scf.standard_id
                JOIN standard_groups sg ON sg.id = s.standard_group_id AND sg.rubric_id = lg.rubric_id
                GROUP BY lg.chat_id, sg.rubric_id, sg.id, sg.name
            ),
            -- Compute upper triangle correlations
            corrs_upper AS (
                SELECT
                    a.rubric_id,
                    a.group_id AS g1,
                    b.group_id AS g2,
                    COUNT(*) FILTER (WHERE a.pct IS NOT NULL AND b.pct IS NOT NULL) AS n,
                    corr(a.pct, b.pct) AS r
                FROM per_grade_group a
                JOIN per_grade_group b
                    ON b.rubric_id = a.rubric_id
                    AND b.chat_id = a.chat_id
                    AND b.group_id >= a.group_id
                GROUP BY a.rubric_id, a.group_id, b.group_id
            ),
            -- Mirror to create full symmetric matrix
            corrs_full AS (
                SELECT rubric_id, g1, g2, n, r FROM corrs_upper
                UNION ALL
                SELECT rubric_id, g2 AS g1, g1 AS g2, n, r
                FROM corrs_upper
                WHERE g1 != g2
            ),
            -- Get groups actually present in data
            groups AS (
                SELECT DISTINCT pgg.rubric_id, sg.id, sg.name, sg.short_name
                FROM per_grade_group pgg
                JOIN standard_groups sg ON sg.id = pgg.group_id
            ),
            valid_rubrics AS (
                SELECT DISTINCT rubric_id FROM groups
            ),
            -- Enrich correlations with p-values, strength, and color
            enriched AS (
                SELECT
                    c.rubric_id, c.g1, c.g2, c.n,
                    CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END AS r,
                    NULL AS p_value,
                    CASE
                        WHEN c.n IS NULL OR c.n < 3 THEN 'No Data'
                        WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.7 THEN 'Strong'
                        WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.4 THEN 'Moderate'
                        WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) > 0.0 THEN 'Weak'
                        ELSE 'No Data'
                    END AS strength,
                    CASE
                        WHEN c.n IS NULL OR c.n < 3 THEN '#e5e7eb'
                        WHEN (CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.0 THEN
                            CASE
                                WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.7 THEN '#10b981'
                                WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.4 THEN '#34d399'
                                ELSE '#a7f3d0'
                            END
                        ELSE
                            CASE
                                WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.7 THEN '#ef4444'
                                WHEN ABS(CASE WHEN c.r = c.r THEN c.r ELSE 0.0 END) >= 0.4 THEN '#f87171'
                                ELSE '#fecaca'
                            END
                    END AS color
                FROM corrs_full c
            ),
            -- Build matrices per rubric
            per_rubric_matrix AS (
                SELECT
                    g1.rubric_id,
                    ROW_NUMBER() OVER (PARTITION BY g1.rubric_id ORDER BY g1.name) - 1 AS row_idx,
                    json_agg(
                        json_build_object(
                            'rubricId', g1.rubric_id::text,
                            'correlation', COALESCE(e.r, 0.0),
                            'pValue', e.p_value,
                            'color', COALESCE(e.color, '#e5e7eb'),
                            'strength', COALESCE(e.strength, 'No Data'),
                            'dataPoints', COALESCE(e.n, 0)
                        )
                        ORDER BY g2.name
                    ) AS row_json
                FROM groups g1
                JOIN groups g2 ON g2.rubric_id = g1.rubric_id
                LEFT JOIN enriched e
                    ON e.rubric_id = g1.rubric_id AND e.g1 = g1.id AND e.g2 = g2.id
                GROUP BY g1.rubric_id, g1.id, g1.name
            ),
            matrix_json AS (
                SELECT rubric_id, json_agg(row_json ORDER BY row_idx) AS matrix
                FROM per_rubric_matrix
                GROUP BY rubric_id
            ),
            sg_json AS (
                SELECT rubric_id,
                    json_agg(json_build_object(
                        'id', id::text,
                        'name', name,
                        'shortName', short_name,
                        'rubricId', rubric_id::text
                    ) ORDER BY name) AS standard_groups
                FROM groups
                GROUP BY rubric_id
            ),
            insights AS (
                SELECT
                    e.rubric_id,
                    CASE
                        WHEN COALESCE(SUM(CASE WHEN e.n >= 3 THEN 1 ELSE 0 END), 0) = 0 THEN NULL
                        ELSE (
                            SELECT 'Top pair: "' || g1.name || '" vs "' || g2.name ||
                                   '" r=' || TO_CHAR(e2.r, 'FM0.00') ||
                                   ' (n=' || e2.n || ')'
                            FROM enriched e2
                            JOIN groups g1 ON g1.id = e2.g1 AND g1.rubric_id = e2.rubric_id
                            JOIN groups g2 ON g2.id = e2.g2 AND g2.rubric_id = e2.rubric_id
                            WHERE e2.rubric_id = e.rubric_id AND e2.n >= 3
                            ORDER BY ABS(e2.r) DESC, e2.n DESC
                            LIMIT 1
                        )
                    END AS txt
                FROM enriched e
                GROUP BY e.rubric_id
            ),
            has_data AS (
                SELECT rubric_id,
                    (SUM(CASE WHEN n >= 3 THEN 1 ELSE 0 END) > 0) AS has_data
                FROM enriched
                GROUP BY rubric_id
            ),
            per_rubric AS (
                SELECT
                    r.rubric_id,
                    COALESCE(m.matrix, '[]'::json) AS matrix,
                    COALESCE(sg.standard_groups, '[]'::json) AS standard_groups,
                    (SELECT txt FROM insights i WHERE i.rubric_id = r.rubric_id) AS insights,
                    (SELECT h.has_data FROM has_data h WHERE h.rubric_id = r.rubric_id) AS has_data
                FROM valid_rubrics r
                LEFT JOIN matrix_json m ON m.rubric_id = r.rubric_id
                LEFT JOIN sg_json sg ON sg.rubric_id = r.rubric_id
            ),
            valid_rubric_ids AS (
                SELECT json_agg(rubric_id::text ORDER BY rubric_id::text) AS payload
                FROM valid_rubrics
            )
            SELECT json_build_object(
                'matrices', COALESCE(
                    (
                        SELECT json_agg(json_build_object(
                            'rubricId', pr.rubric_id::text,
                            'standardGroups', pr.standard_groups,
                            'matrix', pr.matrix,
                            'insights', pr.insights,
                            'hasData', COALESCE(pr.has_data, FALSE)
                        ) ORDER BY pr.rubric_id::text)
                        FROM per_rubric pr
                    ),
                    '[]'::json
                ),
                'validRubricIds', COALESCE((SELECT payload FROM valid_rubric_ids), '[]'::json)
            ) AS result
        """
        )

        return query, params
