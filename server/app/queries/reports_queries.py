"""Reports bundle analytics queries - aggregated metrics per profile."""

from typing import Any

from app.services.base import AnalyticsQueryBuilder


class ReportsQueries:
    """Query builders for reports bundle analytics."""

    def __init__(self) -> None:
        self.builder = AnalyticsQueryBuilder()

    def reports_bundle(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """Build reports bundle query - aggregated metrics per profile."""
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
            profile_metrics AS (
                SELECT
                    f.profile_id,
                    p.first_name,
                    p.last_name,
                    p.alias,
                    p.role,
                    AVG(f.grade_percent) AS avg_score,
                    MAX(f.grade_percent) AS highest_score,
                    COUNT(*)::int AS total_attempts,
                    AVG(f.num_messages_total) AS avg_messages,
                    AVG(f.time_taken_seconds / 60.0) AS avg_time_minutes
                FROM filt f
                JOIN profiles p ON f.profile_id = p.id
                WHERE f.grade_percent IS NOT NULL
                GROUP BY f.profile_id, p.first_name, p.last_name, p.alias, p.role
            ),
            -- Completion percentage per profile
            completion_per_profile AS (
                SELECT
                    f.profile_id,
                    AVG(
                        CASE
                            WHEN COALESCE(f.sim_scenario_count, 0) > 0
                            THEN (100.0 * (CASE WHEN f.completed THEN 1 ELSE 0 END) / f.sim_scenario_count)
                            ELSE 0
                        END
                    )::float AS completion_pct
                FROM filt f
                GROUP BY f.profile_id
            ),
            -- First attempt pass rate per profile
            first_attempts AS (
                SELECT DISTINCT ON (f.simulation_id, f.profile_id)
                    f.profile_id,
                    f.grade_percent >= (f.rubric_pass_points * 100.0 / NULLIF(f.rubric_points, 0)) AS passed
                FROM filt f
                ORDER BY f.simulation_id, f.profile_id, f.attempt_created_at
            ),
            first_attempt_per_profile AS (
                SELECT
                    profile_id,
                    (100.0 * COUNT(*) FILTER (WHERE passed) / NULLIF(COUNT(*), 0))::float AS pass_rate
                FROM first_attempts
                GROUP BY profile_id
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
                    AVG(delta_sec)::float AS avg_response_time
                FROM persona_times
                GROUP BY profile_id
            ),
            -- Session efficiency per profile
            efficiency_per_profile AS (
                SELECT
                    f.profile_id,
                    AVG(f.grade_percent / NULLIF(f.time_taken_seconds / 60.0, 0))::float AS efficiency
                FROM filt f
                WHERE f.time_taken_seconds > 0 AND f.grade_percent IS NOT NULL
                GROUP BY f.profile_id
            ),
            -- Stagnation rate per profile
            user_attempts AS (
                SELECT
                    f.simulation_id,
                    f.profile_id,
                    f.attempt_created_at,
                    f.grade_percent,
                    LAG(f.grade_percent) OVER (
                        PARTITION BY f.simulation_id, f.profile_id
                        ORDER BY f.attempt_created_at
                    ) AS prev_grade
                FROM filt f
            ),
            stagnant_attempts AS (
                SELECT
                    profile_id,
                    CASE
                        WHEN prev_grade IS NOT NULL AND grade_percent <= prev_grade
                        THEN 1 ELSE 0
                    END AS is_stagnant
                FROM user_attempts
                WHERE prev_grade IS NOT NULL
            ),
            stagnation_per_profile AS (
                SELECT
                    profile_id,
                    (100.0 * SUM(is_stagnant) / NULLIF(COUNT(*), 0))::float AS stagnation_rate
                FROM stagnant_attempts
                GROUP BY profile_id
            ),
            -- Join all metrics together
            all_metrics AS (
                SELECT
                    pm.*,
                    COALESCE(cp.completion_pct, 0) AS completion_pct,
                    COALESCE(fa.pass_rate, 0) AS first_attempt_pass_rate,
                    COALESCE(pp.avg_response_time, 0) AS persona_response_time,
                    COALESCE(ep.efficiency, 0) AS session_efficiency,
                    COALESCE(sp.stagnation_rate, 0) AS stagnation_rate
                FROM profile_metrics pm
                LEFT JOIN completion_per_profile cp ON pm.profile_id = cp.profile_id
                LEFT JOIN first_attempt_per_profile fa ON pm.profile_id = fa.profile_id
                LEFT JOIN persona_per_profile pp ON pm.profile_id = pp.profile_id
                LEFT JOIN efficiency_per_profile ep ON pm.profile_id = ep.profile_id
                LEFT JOIN stagnation_per_profile sp ON pm.profile_id = sp.profile_id
            )
            SELECT json_build_object(
                'data', COALESCE((SELECT json_agg(json_build_object(
                    'profileId', profile_id::text,
                    'firstName', first_name,
                    'lastName', last_name,
                    'alias', alias,
                    'role', role,
                    'metrics', json_build_object(
                        'averageScore', json_build_object(
                            'hasData', true,
                            'method', 'avg',
                            'currentValue', ROUND(avg_score)::int,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object(
                                'mean', ROUND(avg_score),
                                'median', ROUND(avg_score),
                                'mode', ROUND(avg_score)
                            )
                        ),
                        'highestScore', json_build_object(
                            'hasData', true,
                            'method', 'max',
                            'currentValue', ROUND(highest_score)::int,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object('top', ARRAY[ROUND(highest_score)])
                        ),
                        'totalAttempts', json_build_object(
                            'hasData', true,
                            'method', 'countDistinct',
                            'currentValue', total_attempts,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object(
                                'attempts', total_attempts,
                                'uniqueSimulations', 0,
                                'perSimulationMean', 0
                            )
                        ),
                        'messagesPerSession', json_build_object(
                            'hasData', true,
                            'method', 'avg',
                            'currentValue', ROUND(avg_messages)::int,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object(
                                'mean', ROUND(avg_messages),
                                'median', ROUND(avg_messages),
                                'count', total_attempts
                            )
                        ),
                        'timeSpent', json_build_object(
                            'hasData', true,
                            'method', 'avg',
                            'currentValue', ROUND(avg_time_minutes)::int,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object(
                                'avgSessionMinutes', ROUND(avg_time_minutes),
                                'avgChatMinutes', ROUND(avg_time_minutes),
                                'avgOverallMinutes', ROUND(avg_time_minutes)
                            )
                        ),
                        'completionPercentage', json_build_object(
                            'hasData', completion_pct > 0,
                            'method', 'rate',
                            'currentValue', ROUND(completion_pct)::int,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object('completed', 0, 'total', 0, 'percent', ROUND(completion_pct)::int)
                        ),
                        'firstAttemptPassRate', json_build_object(
                            'hasData', first_attempt_pass_rate > 0,
                            'method', 'rate',
                            'currentValue', ROUND(first_attempt_pass_rate)::int,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object('passed', 0, 'total', 0, 'percent', ROUND(first_attempt_pass_rate)::int)
                        ),
                        'personaResponseTimes', json_build_object(
                            'hasData', persona_response_time > 0,
                            'method', 'avg',
                            'currentValue', ROUND(persona_response_time)::int,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object('meanSeconds', ROUND(persona_response_time)::int, 'medianSeconds', ROUND(persona_response_time)::int, 'samples', 0)
                        ),
                        'sessionEfficiency', json_build_object(
                            'hasData', session_efficiency > 0,
                            'method', 'avg',
                            'currentValue', ROUND(session_efficiency)::int,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object('avgScorePercent', 0, 'avgMinutes', 0, 'efficiency', ROUND(session_efficiency)::int)
                        ),
                        'stagnationRate', json_build_object(
                            'hasData', stagnation_rate > 0,
                            'method', 'rate',
                            'currentValue', ROUND(stagnation_rate)::int,
                            'trendData', '[]'::json,
                            'dataPoints', '[]'::json,
                            'hover', json_build_object('tracked', 0, 'stagnant', 0, 'ratePercent', ROUND(stagnation_rate)::int)
                        )
                    )
                )) FROM all_metrics), '[]'::json),
                'scenario_mapping', COALESCE((
                    SELECT jsonb_object_agg(
                        s.id::text,
                        jsonb_build_object(
                            'name', s.name,
                            'description', s.problem_statement
                        )
                    )
                    FROM scenarios s
                    WHERE s.active = true
                      AND s.department_id IN (SELECT DISTINCT department_id FROM filt)
                ), '{{}}'::jsonb),
                'simulation_mapping', COALESCE((
                    SELECT jsonb_object_agg(
                        sim.id::text,
                        jsonb_build_object(
                            'name', sim.title,
                            'description', sim.description
                        )
                    )
                    FROM simulations sim
                    WHERE sim.active = true
                      AND sim.practice_simulation = true
                      AND sim.department_id IN (SELECT DISTINCT department_id FROM filt)
                ), '{{}}'::jsonb)
            ) AS result
        """

        return query, params
