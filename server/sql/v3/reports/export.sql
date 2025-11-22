-- Export query for reports - extends reports_bundle.sql pattern
-- Supports additional filters: profileIds, simulationIds, scenarioIds
-- Returns data needed for both Brightspace and regular CSV exports

WITH filtered_profiles AS (
    SELECT p.id, p.first_name, p.last_name, p.email, p.role
    FROM profiles p
    WHERE {PROFILE_WHERE_CLAUSE}{PROFILE_IDS_FILTER}
),
filt AS (
    SELECT a.* FROM analytics a
    WHERE {ANALYTICS_WHERE_CLAUSE}
      AND a.profile_id IN (SELECT id FROM filtered_profiles){SIMULATION_IDS_FILTER}{SCENARIO_IDS_FILTER}
),
-- Profile-level metrics (same as reports_bundle)
profile_metrics AS (
    SELECT
        fp.id AS profile_id,
        fp.first_name,
        fp.last_name,
        fp.email,
        fp.role,
        AVG(f.grade_percent) AS avg_score,
        MAX(f.grade_percent) AS highest_score,
        COUNT(f.attempt_id)::int AS total_attempts,
        AVG(f.num_messages_total) AS avg_messages,
        AVG(f.time_taken_seconds / 60.0) AS avg_time_minutes
    FROM filtered_profiles fp
    LEFT JOIN filt f ON f.profile_id = fp.id AND f.grade_percent IS NOT NULL
    GROUP BY fp.id, fp.first_name, fp.last_name, fp.email, fp.role
),
completion_per_profile AS (
    SELECT
        fp.id AS profile_id,
        (100.0 * AVG((f.completed)::int))::float AS completion_pct
    FROM filtered_profiles fp
    LEFT JOIN filt f ON f.profile_id = fp.id
    GROUP BY fp.id
    HAVING COUNT(f.attempt_id) > 0
),
earliest_attempts_all_time AS (
    SELECT DISTINCT ON (a.profile_id, a.simulation_id)
        a.profile_id,
        a.simulation_id,
        a.attempt_created_at,
        a.grade_percent,
        a.rubric_pass_points,
        a.rubric_points
    FROM analytics a
    WHERE a.profile_id IN (SELECT id FROM filtered_profiles)
    ORDER BY a.profile_id, a.simulation_id, a.attempt_created_at
),
filt_date_range AS (
    SELECT 
        MIN(attempt_created_at) AS min_date,
        MAX(attempt_created_at) AS max_date
    FROM filt
    WHERE attempt_created_at IS NOT NULL
),
first_attempts AS (
    SELECT
        ea.profile_id,
        ea.grade_percent >= (ea.rubric_pass_points * 100.0 / NULLIF(ea.rubric_points, 0)) AS passed
    FROM earliest_attempts_all_time ea
    CROSS JOIN filt_date_range fdr
    WHERE EXISTS (SELECT 1 FROM filt f WHERE f.profile_id = ea.profile_id)
      AND fdr.min_date IS NOT NULL
      AND ea.attempt_created_at >= fdr.min_date
      AND ea.attempt_created_at <= fdr.max_date
),
first_attempt_per_profile AS (
    SELECT
        profile_id,
        (100.0 * COUNT(*) FILTER (WHERE passed) / NULLIF(COUNT(*), 0))::float AS pass_rate
    FROM first_attempts
    GROUP BY profile_id
),
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
efficiency_metrics_per_profile AS (
    SELECT
        f.profile_id,
        AVG(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS avg_score,
        SUM(f.time_taken_seconds / 60.0) FILTER (WHERE f.time_taken_seconds IS NOT NULL) AS total_minutes,
        COUNT(DISTINCT f.chat_id) AS total_sessions
    FROM filt f
    GROUP BY f.profile_id
),
efficiency_per_profile AS (
    SELECT
        profile_id,
        GREATEST(0, LEAST(100, 
            avg_score * (1.0 - LEAST(1.0, (total_minutes / NULLIF(total_sessions, 0)) / 120.0))
        ))::float AS efficiency
    FROM efficiency_metrics_per_profile
    WHERE total_sessions > 0
),
profile_chats AS (
    SELECT DISTINCT profile_id, chat_id 
    FROM filt 
    WHERE chat_id IS NOT NULL
),
grade_stream_per_profile AS (
    SELECT
        pc.profile_id,
        sg.id,
        sg.simulation_chat_id,
        sg.created_at,
        (sg.score::numeric / NULLIF(r.points, 0)) * 100.0 AS norm
    FROM simulation_chat_grades sg
    JOIN profile_chats pc ON pc.chat_id = sg.simulation_chat_id
    JOIN rubrics r ON r.id = sg.rubric_id
),
ordered_grades_per_profile AS (
    SELECT *,
           LAG(norm) OVER (PARTITION BY profile_id ORDER BY created_at) AS prev_norm
    FROM grade_stream_per_profile
),
stagnation_flags_per_profile AS (
    SELECT
        profile_id,
        CASE WHEN prev_norm IS NULL THEN NULL
             WHEN norm <= prev_norm + 0.1 THEN 1 
             ELSE 0 
        END AS stagnated
    FROM ordered_grades_per_profile
    WHERE prev_norm IS NOT NULL
),
stagnation_per_profile AS (
    SELECT
        profile_id,
        (100.0 * AVG(stagnated))::float AS stagnation_rate
    FROM stagnation_flags_per_profile
    GROUP BY profile_id
),
-- Per-simulation metrics for Brightspace export
simulation_metrics_per_profile AS (
    SELECT
        f.profile_id,
        f.simulation_id,
        AVG(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS avg_score,
        MAX(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS highest_score,
        (100.0 * AVG((f.completed)::int))::float AS completion_pct,
        COUNT(f.attempt_id)::int AS total_attempts,
        AVG(f.num_messages_total) AS avg_messages,
        AVG(f.time_taken_seconds / 60.0) AS avg_time_minutes
    FROM filt f
    WHERE f.simulation_id IS NOT NULL
    GROUP BY f.profile_id, f.simulation_id
),
-- First attempt pass rate per simulation
first_attempts_per_sim AS (
    SELECT
        ea.profile_id,
        ea.simulation_id,
        ea.grade_percent >= (ea.rubric_pass_points * 100.0 / NULLIF(ea.rubric_points, 0)) AS passed
    FROM earliest_attempts_all_time ea
    CROSS JOIN filt_date_range fdr
    WHERE EXISTS (SELECT 1 FROM filt f WHERE f.profile_id = ea.profile_id AND f.simulation_id = ea.simulation_id)
      AND fdr.min_date IS NOT NULL
      AND ea.attempt_created_at >= fdr.min_date
      AND ea.attempt_created_at <= fdr.max_date
),
first_attempt_per_sim_profile AS (
    SELECT
        profile_id,
        simulation_id,
        (100.0 * COUNT(*) FILTER (WHERE passed) / NULLIF(COUNT(*), 0))::float AS pass_rate
    FROM first_attempts_per_sim
    GROUP BY profile_id, simulation_id
),
-- Join all metrics together
all_metrics AS (
    SELECT
        pm.*,
        COALESCE(cp.completion_pct, 0) AS completion_pct,
        COALESCE(fa.pass_rate, 0) AS first_attempt_pass_rate,
        COALESCE(pp.avg_response_time, 0) AS persona_response_time,
        COALESCE(ep.efficiency, 0) AS session_efficiency,
        COALESCE(sp.stagnation_rate, 0) AS stagnation_rate,
        -- Per-simulation metrics as JSONB
        COALESCE((
            SELECT jsonb_object_agg(
                sm.simulation_id::text,
                jsonb_build_object(
                    'averageScore', COALESCE(sm.avg_score, 0),
                    'highestScore', COALESCE(sm.highest_score, 0),
                    'completionPercentage', COALESCE(sm.completion_pct, 0),
                    'firstAttemptPassRate', COALESCE(fasp.pass_rate, 0),
                    'totalAttempts', COALESCE(sm.total_attempts, 0),
                    'messagesPerSession', COALESCE(sm.avg_messages, 0),
                    'timeSpent', COALESCE(sm.avg_time_minutes, 0)
                )
            )
            FROM simulation_metrics_per_profile sm
            LEFT JOIN first_attempt_per_sim_profile fasp 
                ON fasp.profile_id = sm.profile_id 
                AND fasp.simulation_id = sm.simulation_id
            WHERE sm.profile_id = pm.profile_id
        ), '{}'::jsonb) AS simulation_metrics
    FROM profile_metrics pm
    LEFT JOIN completion_per_profile cp ON pm.profile_id = cp.profile_id
    LEFT JOIN first_attempt_per_profile fa ON pm.profile_id = fa.profile_id
    LEFT JOIN persona_per_profile pp ON pm.profile_id = pp.profile_id
    LEFT JOIN efficiency_per_profile ep ON pm.profile_id = ep.profile_id
    LEFT JOIN stagnation_per_profile sp ON pm.profile_id = sp.profile_id
)
SELECT json_agg(json_build_object(
    'profileId', profile_id::text,
    'firstName', first_name,
    'lastName', last_name,
    'email', email,
    'role', role,
    'metrics', json_build_object(
        'averageScore', json_build_object(
            'value', ROUND(COALESCE(avg_score, 0))::int,
            'formattedValue', ROUND(COALESCE(avg_score, 0))::int || '%'
        ),
        'highestScore', json_build_object(
            'value', ROUND(COALESCE(highest_score, 0))::int,
            'formattedValue', ROUND(COALESCE(highest_score, 0))::int || '%'
        ),
        'completionPercentage', json_build_object(
            'value', ROUND(COALESCE(completion_pct, 0))::int,
            'formattedValue', ROUND(COALESCE(completion_pct, 0))::int || '%'
        ),
        'firstAttemptPassRate', json_build_object(
            'value', ROUND(COALESCE(first_attempt_pass_rate, 0))::int,
            'formattedValue', ROUND(COALESCE(first_attempt_pass_rate, 0))::int || '%'
        ),
        'messagesPerSession', json_build_object(
            'value', ROUND(COALESCE(avg_messages, 0))::int,
            'formattedValue', ROUND(COALESCE(avg_messages, 0))::int::text
        ),
        'personaResponseTimes', json_build_object(
            'value', ROUND(COALESCE(persona_response_time, 0))::int,
            'formattedValue', ROUND(COALESCE(persona_response_time, 0))::int || 's'
        ),
        'sessionEfficiency', json_build_object(
            'value', ROUND(COALESCE(session_efficiency, 0))::int,
            'formattedValue', ROUND(COALESCE(session_efficiency, 0))::int || '%'
        ),
        'stagnationRate', json_build_object(
            'value', ROUND(COALESCE(stagnation_rate, 0))::int,
            'formattedValue', ROUND(COALESCE(stagnation_rate, 0))::int || '%'
        ),
        'timeSpent', json_build_object(
            'value', ROUND(COALESCE(avg_time_minutes, 0))::int,
            'formattedValue', ROUND(COALESCE(avg_time_minutes, 0))::int || 'm'
        ),
        'totalAttempts', json_build_object(
            'value', COALESCE(total_attempts, 0),
            'formattedValue', COALESCE(total_attempts, 0)::text
        )
    ),
    'simulationMetrics', simulation_metrics
)) FROM all_metrics

