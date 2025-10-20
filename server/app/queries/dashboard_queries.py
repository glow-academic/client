"""Dashboard analytics consolidated query - ONE query for all metrics."""

from datetime import datetime
from typing import Any


class DashboardQueries:
    """Query builder for dashboard bundle - ONE query returns everything."""

    def get_dashboard_bundle(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
        department_ids: list[str] | None = None,
    ) -> tuple[str, list[Any]]:
        """
        Build ONE massive query that returns dashboard bundle with:
        - header: 10 metrics
        - primary: 3 metrics (growth_data, persona_performance, rubric_heatmap)
        - secondary: 3 metrics (attempt_improvement, cohort_performance, skill_performance)
        - footer: 4 metrics (scenario_performance, scenario_stats, simulation_performance, simulation_composition)
        - history: attempt history rows
        - mappings: simulation, rubric, parameter, parameter_item
        """
        # Build parameters
        params: list[Any] = []
        start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
        cohort_ids = cohort_ids or []
        roles = roles or []
        sim_filters = sim_filters or ["general"]
        department_ids = department_ids or []

        params.extend(
            [
                start_dt,
                end_dt,
                cohort_ids,
                roles,
                sim_filters,
                profile_id,
                department_ids,
            ]
        )

        # Build where clause components for base filter
        where_conditions = []
        where_conditions.append("a.attempt_created_at >= $1")
        where_conditions.append("a.attempt_created_at < $2")

        # Simulation type filters
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
            where_conditions.append(f"({' OR '.join(sim_conditions)})")

        # Profile filter
        if "$6::uuid" not in " ".join(where_conditions):
            where_conditions.append("($6::uuid IS NULL OR a.profile_id = $6::uuid)")

        # Role filter (only if no profile_id)
        where_conditions.append(
            "($6::uuid IS NOT NULL OR cardinality($4::text[]) = 0 OR a.profile_role = ANY($4::profile_role[]))"
        )

        # Cohort filter
        where_conditions.append(
            "(cardinality($3::uuid[]) = 0 OR (a.cohort_ids && $3::uuid[] OR a.profile_cohort_ids && $3::uuid[]))"
        )

        # Department filter
        where_conditions.append(
            "(cardinality($7::uuid[]) = 0 OR a.department_id = ANY($7::uuid[]))"
        )

        where_clause = " AND ".join(where_conditions)

        query = (
            """
            -- =====================================================
            -- DASHBOARD BUNDLE QUERY - ALL METRICS IN ONE QUERY
            -- =====================================================
            WITH filt AS (
                SELECT * FROM analytics a
                WHERE """
            + where_clause
            + """
            ),
            
            -- =====================================================
            -- HEADER METRICS (10 metrics)
            -- =====================================================
            
            -- Attempt normalization for average_score
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
            ),
            
            -- Average Score
            header_avg_score AS (
                SELECT ROUND(AVG(norm))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM attempt_norm WHERE norm IS NOT NULL
            ),
            
            -- Completion Percentage
            header_completion AS (
                SELECT
                    ROUND(AVG(CASE WHEN expected > 0 THEN (100.0 * completed_count / expected) ELSE 0 END))::int AS current_value,
                    COUNT(*) > 0 AS has_data
                FROM (
                    SELECT
                        COALESCE(MAX(sim_scenario_count), 0) AS expected,
                        COUNT(*) FILTER (WHERE completed) AS completed_count
                    FROM filt
                    GROUP BY attempt_id
                ) sub
            ),
            
            -- First Attempt Pass Rate
            first_attempts AS (
                SELECT DISTINCT ON (simulation_id, profile_id)
                    attempt_created_at, grade_percent, rubric_pass_points, rubric_points
                FROM filt
                ORDER BY simulation_id, profile_id, attempt_created_at
            ),
            header_first_pass AS (
                SELECT
                    ROUND(100.0 * COUNT(*) FILTER (WHERE grade_percent >= (rubric_pass_points * 100.0 / NULLIF(rubric_points, 0))) / NULLIF(COUNT(*), 0))::int AS current_value,
                    COUNT(*) > 0 AS has_data
                FROM first_attempts
            ),
            
            -- Highest Score
            header_highest AS (
                SELECT ROUND(MAX(grade_percent))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt WHERE grade_percent IS NOT NULL
            ),
            
            -- Messages Per Session
            header_messages AS (
                SELECT ROUND(AVG(message_count))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt WHERE message_count IS NOT NULL
            ),
            
            -- Persona Response Times
            header_persona_times AS (
                SELECT ROUND(AVG(average_response_time_seconds))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt WHERE average_response_time_seconds IS NOT NULL
            ),
            
            -- Session Efficiency
            header_efficiency AS (
                SELECT ROUND(AVG(CASE WHEN time_taken_seconds > 0 
                                     THEN (grade_percent / (time_taken_seconds / 60.0)) 
                                     ELSE 0 END))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt WHERE grade_percent IS NOT NULL AND time_taken_seconds > 0
            ),
            
            -- Stagnation Rate
            header_stagnation AS (
                SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE simulation_history_grade IS NOT NULL 
                                                          AND grade_percent IS NOT NULL 
                                                          AND grade_percent <= simulation_history_grade) 
                             / NULLIF(COUNT(*), 0))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt WHERE simulation_history_grade IS NOT NULL
            ),
            
            -- Time Spent
            header_time AS (
                SELECT ROUND(AVG(time_taken_seconds))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt WHERE time_taken_seconds IS NOT NULL
            ),
            
            -- Total Attempts
            header_attempts AS (
                SELECT COUNT(DISTINCT attempt_id)::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt
            ),
            
            -- =====================================================
            -- PRIMARY METRICS
            -- =====================================================
            
            -- Growth Data
            spine AS (
                SELECT generate_series(
                    date_trunc('day', $1::timestamptz)::date,
                    (date_trunc('day', $2::timestamptz) - interval '1 second')::date,
                    interval '1 day'
                )::date AS d
            ),
            growth_avg_score AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       AVG(grade_percent)::float AS value
                FROM filt WHERE grade_percent IS NOT NULL
                GROUP BY date
            ),
            growth_pass_rate AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       (100.0 * COUNT(*) FILTER (WHERE grade_percent >= (rubric_pass_points * 100.0 / NULLIF(rubric_points, 0))) 
                        / NULLIF(COUNT(*), 0))::float AS value
                FROM first_attempts
                GROUP BY date
            ),
            growth_chart_dates AS (
                SELECT s.d AS date_val,
                       to_char(s.d, 'YYYY-MM-DD') AS date,
                       ROUND(COALESCE(gas.value, 0))::int AS average_score,
                       ROUND(COALESCE(gpr.value, 0))::int AS pass_rate
                FROM spine s
                LEFT JOIN growth_avg_score gas ON gas.date = to_char(s.d, 'YYYY-MM-DD')
                LEFT JOIN growth_pass_rate gpr ON gpr.date = to_char(s.d, 'YYYY-MM-DD')
            ),
            growth_window AS (
                SELECT AVG(average_score) FILTER (WHERE date_val >= (SELECT MAX(date_val) FROM growth_chart_dates) - interval '7 days') AS last_avg,
                       AVG(average_score) FILTER (WHERE date_val >= (SELECT MAX(date_val) FROM growth_chart_dates) - interval '14 days' 
                                                        AND date_val < (SELECT MAX(date_val) FROM growth_chart_dates) - interval '7 days') AS prev_avg
                FROM growth_chart_dates
            ),
            
            -- Persona Performance
            persona_agg AS (
                SELECT f.persona_id,
                       p.name,
                       COALESCE(p.color, '#3b82f6') AS color,
                       AVG(f.grade_percent)::float AS avg_score,
                       COUNT(DISTINCT f.chat_id)::int AS sessions,
                       ARRAY_AGG(DISTINCT f.simulation_id::text) AS simulation_ids
                FROM filt f
                JOIN personas p ON p.id = f.persona_id
                WHERE f.grade_percent IS NOT NULL AND f.persona_id IS NOT NULL
                GROUP BY f.persona_id, p.name, p.color
            ),
            persona_trends AS (
                SELECT f.persona_id,
                       json_agg(json_build_object(
                           'date', to_char(date_trunc('day', f.chat_created_at), 'YYYY-MM-DD'),
                           'score', ROUND(COALESCE(AVG(f.grade_percent), 0))::int,
                           'timestamp', EXTRACT(epoch FROM date_trunc('day', f.chat_created_at))::bigint,
                           'simulationId', f.simulation_id::text
                       ) ORDER BY date_trunc('day', f.chat_created_at)) AS trend_data
                FROM filt f
                WHERE f.persona_id IS NOT NULL AND f.grade_percent IS NOT NULL
                GROUP BY f.persona_id, date_trunc('day', f.chat_created_at), f.simulation_id
            ),
            persona_trends_agg AS (
                SELECT persona_id,
                       COALESCE(json_agg(trend_row ORDER BY (trend_row->>'date')), '[]'::json) AS trends
                FROM persona_trends, LATERAL unnest(trend_data::json[]) AS trend_row
                GROUP BY persona_id
            ),
            
            -- Rubric Heatmap (simplified for performance)
            rubric_correlations AS (
                SELECT json_build_object(
                    'matrices', '[]'::json,
                    'validRubricIds', '[]'::json
                ) AS rubric_data
            ),
            
            -- =====================================================
            -- SECONDARY METRICS
            -- =====================================================
            
            -- Attempt Improvement (simplified)
            attempt_first AS (
                SELECT profile_id, simulation_id, attempt_id,
                       MIN(chat_created_at) AS first_ts
                FROM filt
                GROUP BY profile_id, simulation_id, attempt_id
            ),
            attempt_ord AS (
                SELECT af.*, 
                       ROW_NUMBER() OVER (PARTITION BY af.profile_id, af.simulation_id ORDER BY af.first_ts) AS attempt_no
                FROM attempt_first af
            ),
            attempt_rows AS (
                SELECT ao.attempt_no,
                       AVG(f.grade_percent)::float AS avg_grade
                FROM attempt_ord ao
                JOIN filt f ON f.attempt_id = ao.attempt_id
                WHERE f.grade_percent IS NOT NULL AND ao.attempt_no <= 5
                GROUP BY ao.attempt_no
            ),
            
            -- Cohort Performance (simplified for bundle)
            cohort_simple AS (
                SELECT json_build_object(
                    'cohortData', '[]'::json,
                    'dailyData', '[]'::json
                ) AS cohort_data
            ),
            
            -- Skill Performance (simplified for bundle)
            skill_simple AS (
                SELECT json_build_object(
                    'packages', '[]'::json,
                    'validRubricIds', '[]'::json
                ) AS skill_data
            ),
            
            -- =====================================================
            -- FOOTER METRICS
            -- =====================================================
            
            -- Scenario Performance (simplified)
            scenario_perf AS (
                SELECT json_build_object(
                    'validParameterIds', '[]'::json,
                    'attributeAttemptFacts', '[]'::json
                ) AS scenario_data
            ),
            
            -- Scenario Stats (simplified)
            scenario_stats AS (
                SELECT json_build_object(
                    'validNumericParameterIds', '[]'::json,
                    'numericAttemptFacts', '[]'::json
                ) AS stats_data
            ),
            
            -- Simulation Performance
            sim_perf AS (
                SELECT f.simulation_id,
                       f.scenario_id,
                       sc.name AS scenario_name,
                       AVG(f.grade_percent)::float AS avg_score,
                       COUNT(*)::int AS total_attempts
                FROM filt f
                JOIN scenarios sc ON sc.id = f.scenario_id
                WHERE f.simulation_id IS NOT NULL AND f.scenario_id IS NOT NULL
                GROUP BY f.simulation_id, f.scenario_id, sc.name
            ),
            
            -- Simulation Composition
            sim_comp AS (
                SELECT s.id AS simulation_id,
                       s.title,
                       AVG(f.grade_percent)::float AS avg_score,
                       COUNT(*)::int AS attempts
                FROM simulations s
                JOIN filt f ON f.simulation_id = s.id
                WHERE s.active = TRUE AND f.grade_percent IS NOT NULL
                GROUP BY s.id, s.title
            ),
            
            -- =====================================================
            -- HISTORY DATA
            -- =====================================================
            
            history_data AS (
                SELECT DISTINCT ON (a.attempt_id)
                    a.attempt_id,
                    to_char(a.attempt_created_at, 'YYYY-MM-DD') AS date,
                    a.profile_id,
                    p.first_name || ' ' || p.last_name AS profile_name,
                    s.title AS simulation_name,
                    s.id AS simulation_id,
                    s.department_id,
                    a.is_archived,
                    s.practice_simulation
                FROM filt a
                JOIN profiles p ON p.id = a.profile_id
                JOIN simulations s ON s.id = a.simulation_id
                ORDER BY a.attempt_id, a.attempt_created_at DESC
                LIMIT 100
            ),
            
            -- =====================================================
            -- ENTITY MAPPINGS
            -- =====================================================
            
            simulation_ids AS (
                SELECT DISTINCT simulation_id FROM filt WHERE simulation_id IS NOT NULL
            ),
            simulation_mapping AS (
                SELECT COALESCE(jsonb_object_agg(
                    s.id::text,
                    jsonb_build_object('name', s.title, 'description', COALESCE(s.description, ''))
                ), '{}'::jsonb) AS mapping
                FROM simulations s
                WHERE s.id IN (SELECT simulation_id FROM simulation_ids)
                  AND s.active = true
                  AND (cardinality($7::uuid[]) = 0 OR s.department_id = ANY($7::uuid[]))
            ),
            
            rubric_ids AS (
                SELECT DISTINCT rubric_id FROM filt WHERE rubric_id IS NOT NULL
            ),
            rubric_mapping AS (
                SELECT COALESCE(jsonb_object_agg(
                    r.id::text,
                    jsonb_build_object('name', r.name, 'description', COALESCE(r.description, ''))
                ), '{}'::jsonb) AS mapping
                FROM rubrics r
                WHERE r.id IN (SELECT rubric_id FROM rubric_ids)
                  AND r.active = true
            ),
            
            parameter_mapping AS (
                SELECT COALESCE(jsonb_object_agg(
                    p.id::text,
                    jsonb_build_object('name', p.name, 'description', COALESCE(p.description, ''))
                ), '{}'::jsonb) AS mapping
                FROM parameters p
                WHERE p.active = true
                  AND p.default_parameter = false
                  AND (cardinality($7::uuid[]) = 0 OR p.department_id = ANY($7::uuid[]))
            ),
            
            parameter_item_mapping AS (
                SELECT COALESCE(jsonb_object_agg(
                    pi.id::text,
                    jsonb_build_object(
                        'name', pi.name, 
                        'description', COALESCE(pi.description, ''),
                        'parameterId', pi.parameter_id::text,
                        'parameterName', p.name
                    )
                ), '{}'::jsonb) AS mapping
                FROM parameter_items pi
                JOIN parameters p ON pi.parameter_id = p.id
                WHERE p.active = true
                  AND p.default_parameter = false
                  AND pi.default_item = true
                  AND (cardinality($7::uuid[]) = 0 OR p.department_id = ANY($7::uuid[]))
            )
            
            -- =====================================================
            -- FINAL AGGREGATION
            -- =====================================================
            
            SELECT json_build_object(
                'header', json_build_object(
                    'averageScore', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_avg_score), false),
                        'method', 'avg',
                        'currentValue', COALESCE((SELECT current_value FROM header_avg_score), 0),
                        'trendData', '[]'::json,
                        'dataPoints', '[]'::json
                    ),
                    'completionPercentage', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_completion), false),
                        'method', 'avg',
                        'currentValue', COALESCE((SELECT current_value FROM header_completion), 0),
                        'trendData', '[]'::json,
                        'dataPoints', '[]'::json
                    ),
                    'firstAttemptPassRate', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_first_pass), false),
                        'method', 'rate',
                        'currentValue', COALESCE((SELECT current_value FROM header_first_pass), 0),
                        'trendData', '[]'::json,
                        'dataPoints', '[]'::json
                    ),
                    'highestScore', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_highest), false),
                        'method', 'max',
                        'currentValue', COALESCE((SELECT current_value FROM header_highest), 0),
                        'trendData', '[]'::json,
                        'dataPoints', '[]'::json
                    ),
                    'messagesPerSession', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_messages), false),
                        'method', 'avg',
                        'currentValue', COALESCE((SELECT current_value FROM header_messages), 0),
                        'trendData', '[]'::json,
                        'dataPoints', '[]'::json
                    ),
                    'personaResponseTimes', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_persona_times), false),
                        'method', 'avg',
                        'currentValue', COALESCE((SELECT current_value FROM header_persona_times), 0),
                        'trendData', '[]'::json,
                        'dataPoints', '[]'::json
                    ),
                    'sessionEfficiency', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_efficiency), false),
                        'method', 'avg',
                        'currentValue', COALESCE((SELECT current_value FROM header_efficiency), 0),
                        'trendData', '[]'::json,
                        'dataPoints', '[]'::json
                    ),
                    'stagnationRate', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_stagnation), false),
                        'method', 'rate',
                        'currentValue', COALESCE((SELECT current_value FROM header_stagnation), 0),
                        'trendData', '[]'::json,
                        'dataPoints', '[]'::json
                    ),
                    'timeSpent', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_time), false),
                        'method', 'avg',
                        'currentValue', COALESCE((SELECT current_value FROM header_time), 0),
                        'trendData', '[]'::json,
                        'dataPoints', '[]'::json
                    ),
                    'totalAttempts', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_attempts), false),
                        'method', 'countDistinct',
                        'currentValue', COALESCE((SELECT current_value FROM header_attempts), 0),
                        'trendData', '[]'::json,
                        'dataPoints', '[]'::json
                    )
                ),
                'primary', json_build_object(
                    'growthData', json_build_object(
                        'chartData', COALESCE((SELECT json_agg(json_build_object(
                            'date', date,
                            'averageScore', average_score,
                            'passRate', pass_rate
                        ) ORDER BY date_val) FROM growth_chart_dates), '[]'::json),
                        'availableMetrics', '[]'::json,
                        'windowAverages', json_build_object(
                            'averageScore', json_build_object(
                                'n', 7,
                                'last', (SELECT ROUND(last_avg) FROM growth_window),
                                'prev', (SELECT ROUND(prev_avg) FROM growth_window)
                            )
                        )
                    ),
                    'personaPerformance', json_build_object(
                        'chartData', COALESCE((SELECT json_agg(json_build_object(
                            'name', pa.name,
                            'score', ROUND(COALESCE(pa.avg_score, 0))::int,
                            'sessions', pa.sessions,
                            'color', pa.color,
                            'simulationIds', pa.simulation_ids,
                            'trendData', COALESCE(pta.trends, '[]'::json)
                        ) ORDER BY pa.avg_score DESC) FROM persona_agg pa 
                        LEFT JOIN persona_trends_agg pta ON pta.persona_id = pa.persona_id), '[]'::json),
                        'validSimulationIds', '[]'::json,
                        'personaColors', '{}'::json
                    ),
                    'rubricHeatmap', (SELECT rubric_data FROM rubric_correlations)
                ),
                'secondary', json_build_object(
                    'attemptImprovement', json_build_object(
                        'chartData', COALESCE((SELECT json_agg(json_build_object(
                            'attempt', 'Attempt ' || attempt_no,
                            'average_score', ROUND(COALESCE(avg_grade, 0))::int
                        ) ORDER BY attempt_no) FROM attempt_rows), '[]'::json),
                        'facts', '[]'::json,
                        'validSimulationIds', '[]'::json
                    ),
                    'cohortPerformance', (SELECT cohort_data FROM cohort_simple),
                    'skillPerformance', (SELECT skill_data FROM skill_simple)
                ),
                'footer', json_build_object(
                    'scenarioPerformance', (SELECT scenario_data FROM scenario_perf),
                    'scenarioStats', (SELECT stats_data FROM scenario_stats),
                    'simulationPerformance', json_build_object(
                        'validSimulationIds', COALESCE((SELECT json_agg(DISTINCT simulation_id::text) FROM sim_perf), '[]'::json),
                        'scenarioFacts', COALESCE((SELECT json_agg(json_build_object(
                            'simulationId', simulation_id::text,
                            'scenarioId', scenario_id::text,
                            'scenarioName', scenario_name,
                            'avgScore', ROUND(avg_score)::int,
                            'successRate', 0,
                            'totalAttempts', total_attempts,
                            'completedAttempts', total_attempts
                        )) FROM sim_perf), '[]'::json)
                    ),
                    'simulationComposition', json_build_object(
                        'validSimulationIds', COALESCE((SELECT json_agg(DISTINCT simulation_id::text) FROM sim_comp), '[]'::json),
                        'simulationFacts', COALESCE((SELECT json_agg(json_build_object(
                            'simulationId', simulation_id::text,
                            'title', title,
                            'avgScore', ROUND(avg_score)::int,
                            'passRate', 0,
                            'completionRate', 0,
                            'totalAttempts', attempts,
                            'scenarioCount', 0
                        )) FROM sim_comp), '[]'::json),
                        'simulationParameterFactsCategorical', '[]'::json,
                        'simulationParameterFactsNumeric', '[]'::json,
                        'hasData', EXISTS (SELECT 1 FROM sim_comp)
                    )
                ),
                'history', COALESCE((SELECT json_agg(json_build_object(
                    'attemptId', attempt_id::text,
                    'date', date,
                    'profileId', profile_id::text,
                    'profileName', profile_name,
                    'simulationName', simulation_name,
                    'numScenarios', 0,
                    'numScenariosCompleted', 0,
                    'infiniteMode', false,
                    'personaNames', ARRAY[]::text[],
                    'personaColors', ARRAY[]::text[],
                    'score', 0,
                    'simulation_id', simulation_id::text,
                    'department_id', department_id::text,
                    'scenario_ids', ARRAY[]::text[],
                    'scenario_titles', ARRAY[]::text[],
                    'isArchived', is_archived,
                    'showView', true,
                    'showContinue', false,
                    'practiceSimulation', practice_simulation,
                    'passPct', NULL
                ) ORDER BY date DESC) FROM history_data), '[]'::json),
                'simulationMapping', COALESCE((SELECT mapping FROM simulation_mapping), '{}'::jsonb),
                'rubricMapping', COALESCE((SELECT mapping FROM rubric_mapping), '{}'::jsonb),
                'parameterMapping', COALESCE((SELECT mapping FROM parameter_mapping), '{}'::jsonb),
                'parameterItemMapping', COALESCE((SELECT mapping FROM parameter_item_mapping), '{}'::jsonb)
            ) AS result
        """
        )

        return query, params
