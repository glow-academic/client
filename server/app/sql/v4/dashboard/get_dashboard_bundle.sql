
            -- =====================================================
            -- DASHBOARD BUNDLE QUERY - ALL METRICS IN ONE QUERY
            -- Parameters: $1-$2: dates, $3: cohort_ids, $4: roles, $5: sim_filters, $6: department_ids
            -- =====================================================
            WITH
            -- Get thresholds from active settings (defaults if no settings found)
            settings_thresholds AS (
                SELECT 
                    COALESCE(success_threshold, 85) AS success_threshold,
                    COALESCE(warning_threshold, 80) AS warning_threshold,
                    COALESCE(danger_threshold, 70) AS danger_threshold
                FROM settings
                WHERE active = true
                LIMIT 1
            ),
            -- Filter simulations by cohorts (new filtering order: cohorts → simulations)
            -- Gets simulations linked to cohorts + practice simulations without cohorts
            filtered_simulation_ids AS (
                SELECT DISTINCT s.id AS simulation_id
                FROM simulations s
                WHERE s.active = TRUE
                  AND (
                      -- If cohort_ids provided, get simulations linked to those cohorts
                      (cardinality($3::uuid[]) > 0 AND EXISTS (
                          SELECT 1 
                          FROM cohort_simulations cs 
                          WHERE cs.simulation_id = s.id 
                            AND cs.cohort_id = ANY($3::uuid[])
                            AND cs.active = TRUE
                      ))
                      OR
                      -- Always include practice simulations without cohorts
                      (s.practice_simulation = TRUE 
                       AND NOT EXISTS (
                           SELECT 1 
                           FROM cohort_simulations cs2 
                           WHERE cs2.simulation_id = s.id 
                             AND cs2.active = TRUE
                       ))
                      OR
                      -- If no cohort_ids provided, include all simulations
                      (cardinality($3::uuid[]) = 0)
                  )
            ),
            filt AS (
                SELECT * FROM analytics a
                WHERE a.attempt_created_at >= $1 
                    AND a.attempt_created_at < $2 
                    AND ($5::text[] IS NULL OR cardinality($5::text[]) > 0)
                    AND (
                        $5::text[] IS NULL OR (
                            ('general' = ANY($5::text[]) AND a.is_general = TRUE) OR
                            ('practice' = ANY($5::text[]) AND a.is_practice = TRUE) OR
                            ('archived' = ANY($5::text[]) AND a.is_archived = TRUE)
                        )
                    )
                    -- Exclude archived attempts unless 'archived' is explicitly in the filter list
                    AND (
                        'archived' = ANY($5::text[]) OR a.is_archived = FALSE
                    )
                    -- Dashboard never filters by profile - always filter by roles
                    AND a.profile_role = ANY($4::profile_role[])
                    -- Filter by simulation_ids from cohorts (new filtering order)
                    AND (cardinality($3::uuid[]) = 0 OR a.simulation_id IN (SELECT simulation_id FROM filtered_simulation_ids))
                    -- Filter by department_ids (empty array = all departments)
                    AND (cardinality($6::uuid[]) = 0 OR a.department_id = ANY($6::uuid[]))
            ),
            
            -- =====================================================
            -- HEADER METRICS (10 metrics)
            -- =====================================================
            
            -- Attempt normalization for average_score
            per_attempt AS (
                SELECT
                    attempt_id,
                    MIN(attempt_created_at) AS attempt_created_at,
                    (array_agg(profile_id))[1] AS profile_id,
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
                    profile_id,
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
            
            -- Completion Percentage (chat-level aggregation from old stored procedure)
            header_completion AS (
                SELECT ROUND(100.0 * AVG((completed)::int))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt
            ),
            
            -- First Attempt Pass Rate (earliest attempt all-time, then filter to window)
            earliest_attempt_all_time AS (
                SELECT DISTINCT ON (a.profile_id, a.simulation_id)
                       a.attempt_id, a.profile_id, a.simulation_id, a.attempt_created_at,
                       a.grade_percent, a.rubric_pass_points, a.rubric_points
                FROM analytics a
                WHERE (
                    -- Match simulation type filters
                    ('general' = ANY($5::text[]) AND a.is_general = TRUE) OR
                    ('practice' = ANY($5::text[]) AND a.is_practice = TRUE) OR
                    ('archived' = ANY($5::text[]) AND a.is_archived = TRUE)
                )
                -- Exclude archived attempts unless 'archived' is explicitly in the filter list
                AND (
                    'archived' = ANY($5::text[]) OR a.is_archived = FALSE
                )
                -- Dashboard never filters by profile - always filter by roles
                AND a.profile_role = ANY($4::profile_role[])
                -- Filter by simulation_ids from cohorts (new filtering order)
                AND (cardinality($3::uuid[]) = 0 OR a.simulation_id IN (SELECT simulation_id FROM filtered_simulation_ids))
                -- Filter by department_ids (empty array = all departments)
                AND (cardinality($6::uuid[]) = 0 OR a.department_id = ANY($6::uuid[]))
                ORDER BY a.profile_id, a.simulation_id, a.attempt_created_at
            ),
            first_attempts AS (
                SELECT * FROM earliest_attempt_all_time
                WHERE attempt_created_at >= $1 AND attempt_created_at < $2
            ),
            header_first_pass AS (
                SELECT
                    ROUND(100.0 * COUNT(*) FILTER (WHERE grade_percent >= (rubric_pass_points * 100.0 / NULLIF(rubric_points, 0))) / GREATEST(COUNT(*), 1))::int AS current_value,
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
                SELECT ROUND(AVG(num_messages_total))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt WHERE num_messages_total IS NOT NULL
            ),
            
            -- Persona Response Times
            persona_times AS (
                SELECT UNNEST(message_time_taken_seconds) AS delta_sec
                FROM filt 
                WHERE cardinality(message_time_taken_seconds) > 0
            ),
            header_persona_times AS (
                SELECT ROUND(AVG(delta_sec))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM persona_times
            ),
            
            -- Session Efficiency (old formula: avgScore * (1 - min(1, avgMinutes/120)))
            user_metrics_for_efficiency AS (
                SELECT
                    AVG(grade_percent) FILTER (WHERE grade_percent IS NOT NULL) AS avg_score,
                    SUM(time_taken_seconds / 60.0) FILTER (WHERE time_taken_seconds IS NOT NULL) AS total_minutes,
                    COUNT(DISTINCT chat_id) AS total_sessions
                FROM filt
            ),
            header_efficiency AS (
                SELECT 
                    GREATEST(0, LEAST(100, ROUND(
                        avg_score * (1.0 - LEAST(1.0, (total_minutes / NULLIF(total_sessions, 0)) / 120.0))
                    )))::int AS current_value,
                    total_sessions > 0 AS has_data
                FROM user_metrics_for_efficiency
            ),
            
            -- Stagnation Rate (grade-stream approach from old stored procedure)
            filtered_chats_for_stagnation AS (
                SELECT DISTINCT chat_id FROM filt WHERE chat_id IS NOT NULL
            ),
            grade_stream AS (
                SELECT
                    sg.id,
                    c_stag.id AS simulation_chat_id,
                    sg.created_at,
                    (sg.score::numeric / NULLIF(r.points, 0)) * 100.0 AS norm
                FROM grades sg
                JOIN runs r_stag ON r_stag.id = sg.run_id
                JOIN group_runs gr_stag ON gr_stag.run_id = r_stag.id
                JOIN groups g_stag ON g_stag.id = gr_stag.group_id
                JOIN chat_groups cg_stag ON cg_stag.group_id = g_stag.id
                JOIN chats c_stag ON c_stag.id = cg_stag.chat_id
                JOIN filtered_chats_for_stagnation fc ON fc.chat_id = c_stag.id
                JOIN rubrics r ON r.id = sg.rubric_id
                WHERE EXISTS (
                    SELECT 1 FROM runs r_check
                    JOIN group_runs gr_check ON gr_check.run_id = r_check.id
                    JOIN groups g_check ON g_check.id = gr_check.group_id
                    JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
                    JOIN chats c_check ON c_check.id = cg_check.chat_id
                    WHERE r_check.id = sg.run_id
                )
            ),
            ordered_grades AS (
                SELECT *,
                       LAG(norm) OVER (ORDER BY created_at) AS prev_norm
                FROM grade_stream
            ),
            stagnation_flags AS (
                SELECT *,
                       CASE WHEN prev_norm IS NULL THEN NULL
                            WHEN norm <= prev_norm + 0.1 THEN 1 
                            ELSE 0 
                       END AS stagnated
                FROM ordered_grades
                WHERE prev_norm IS NOT NULL
            ),
            header_stagnation AS (
                SELECT ROUND(100.0 * AVG(stagnated))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM stagnation_flags
            ),
            
            -- Time Spent (SUM with 30-minute cap per chat, in minutes)
            header_time AS (
                SELECT ROUND(SUM(LEAST(time_taken_seconds / 60.0, 30.0)))::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt 
                WHERE time_taken_seconds IS NOT NULL
            ),
            
            -- Total Attempts
            header_attempts AS (
                SELECT COUNT(DISTINCT attempt_id)::int AS current_value,
                       COUNT(*) > 0 AS has_data
                FROM filt
            ),
            
            -- =====================================================
            -- HEADER METRICS TREND DATA (for trend charts)
            -- =====================================================
            
            -- Average Score Trend (using attempt normalization)
            header_avg_score_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(AVG(norm))::float AS value,
                    COUNT(*)::int AS count
                FROM attempt_norm
                WHERE norm IS NOT NULL
                GROUP BY date
                ORDER BY date
            ),
            
            -- Completion Percentage Trend
            header_completion_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(100.0 * AVG((completed)::int))::float AS value,
                    COUNT(*)::int AS count
                FROM filt
                GROUP BY date
                ORDER BY date
            ),
            
            -- First Attempt Pass Rate Trend
            header_first_pass_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(100.0 * COUNT(*) FILTER (WHERE grade_percent >= (rubric_pass_points * 100.0 / NULLIF(rubric_points, 0))) / GREATEST(COUNT(*), 1))::float AS value,
                    COUNT(*)::int AS count
                FROM first_attempts
                GROUP BY date
                ORDER BY date
            ),
            
            -- Highest Score Trend
            header_highest_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(MAX(grade_percent))::float AS value,
                    COUNT(*)::int AS count
                FROM filt
                WHERE grade_percent IS NOT NULL
                GROUP BY date
                ORDER BY date
            ),
            
            -- Messages Per Session Trend
            header_messages_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(AVG(num_messages_total))::float AS value,
                    COUNT(*)::int AS count
                FROM filt
                WHERE num_messages_total IS NOT NULL
                GROUP BY date
                ORDER BY date
            ),
            
            -- Persona Response Times Trend
            header_persona_times_trend AS (
                SELECT 
                    to_char(pt.attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(AVG(pt.delta_sec))::float AS value,
                    COUNT(*)::int AS count
                FROM (
                    SELECT attempt_created_at, UNNEST(message_time_taken_seconds) AS delta_sec
                    FROM filt
                    WHERE cardinality(message_time_taken_seconds) > 0
                ) pt
                GROUP BY date
                ORDER BY date
            ),
            
            -- Session Efficiency Trend (user-level aggregation by date)
            user_metrics_for_efficiency_by_date AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    profile_id,
                    AVG(grade_percent) FILTER (WHERE grade_percent IS NOT NULL) AS avg_score,
                    SUM(time_taken_seconds / 60.0) FILTER (WHERE time_taken_seconds IS NOT NULL) AS total_minutes,
                    COUNT(DISTINCT chat_id) AS total_sessions
                FROM filt
                GROUP BY date, profile_id
            ),
            header_efficiency_trend AS (
                SELECT 
                    date,
                    ROUND(GREATEST(0, LEAST(100, AVG(
                        avg_score * (1.0 - LEAST(1.0, (total_minutes / NULLIF(total_sessions, 0)) / 120.0))
                    ))))::float AS value,
                    COUNT(*)::int AS count
                FROM user_metrics_for_efficiency_by_date
                WHERE total_sessions > 0
                GROUP BY date
                ORDER BY date
            ),
            
            -- Stagnation Rate Trend
            header_stagnation_trend AS (
                SELECT 
                    to_char(created_at, 'YYYY-MM-DD') AS date,
                    ROUND(100.0 * AVG(stagnated))::float AS value,
                    COUNT(*)::int AS count
                FROM stagnation_flags
                GROUP BY date
                ORDER BY date
            ),
            
            -- Time Spent Trend (with 30-minute cap per chat)
            header_time_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(AVG(LEAST(30.0, time_taken_seconds / 60.0)))::float AS value,
                    COUNT(*)::int AS count
                FROM filt
                WHERE time_taken_seconds IS NOT NULL
                GROUP BY date
                ORDER BY date
            ),
            
            -- Total Attempts Trend
            header_attempts_trend AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    COUNT(DISTINCT attempt_id)::float AS value,
                    COUNT(*)::int AS count
                FROM filt
                GROUP BY date
                ORDER BY date
            ),
            
            -- =====================================================
            -- HEADER METRICS DATA POINTS (for hover tooltips)
            -- =====================================================
            
            -- Average Score Data Points
            header_avg_score_points AS (
                SELECT 
                    COALESCE(an.profile_id::text, '') AS profile_id,
                    to_char(an.attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(an.norm)::int AS value,
                    COALESCE(an.attempt_id::text, '') AS attempt_id,
                    ''::text AS simulation_id,
                    ''::text AS scenario_id
                FROM attempt_norm an
                WHERE an.norm IS NOT NULL
                ORDER BY an.profile_id, an.attempt_created_at
            ),
            
            -- Completion Percentage Data Points
            header_completion_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    (f.completed::int * 100)::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                ORDER BY f.profile_id, f.attempt_created_at
            ),
            
            -- First Attempt Pass Rate Data Points
            header_first_pass_points AS (
                SELECT 
                    fa.profile_id::text AS profile_id,
                    to_char(fa.attempt_created_at, 'YYYY-MM-DD') AS date,
                    CASE 
                        WHEN fa.grade_percent >= (fa.rubric_pass_points * 100.0 / NULLIF(fa.rubric_points, 0)) THEN 100
                        ELSE 0
                    END::int AS value,
                    fa.attempt_id::text AS attempt_id,
                    fa.simulation_id::text AS simulation_id,
                    NULL::text AS scenario_id
                FROM first_attempts fa
                ORDER BY fa.profile_id, fa.attempt_created_at
            ),
            
            -- Highest Score Data Points
            header_highest_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(f.grade_percent)::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                WHERE f.grade_percent IS NOT NULL
                ORDER BY f.profile_id, f.attempt_created_at
            ),
            
            -- Messages Per Session Data Points
            header_messages_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    f.num_messages_total::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                WHERE f.num_messages_total IS NOT NULL
                ORDER BY f.profile_id, f.attempt_created_at
            ),
            
            -- Persona Response Times Data Points
            header_persona_times_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(pt.delta_sec)::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                CROSS JOIN LATERAL UNNEST(f.message_time_taken_seconds) AS pt(delta_sec)
                WHERE cardinality(f.message_time_taken_seconds) > 0
                ORDER BY f.profile_id, f.attempt_created_at
            ),
            
            -- Session Efficiency Data Points
            header_efficiency_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(GREATEST(0, LEAST(100, 
                        f.grade_percent * (1.0 - LEAST(1.0, (f.time_taken_seconds / 60.0) / 120.0))
                    )))::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                WHERE f.grade_percent IS NOT NULL AND f.time_taken_seconds IS NOT NULL
                ORDER BY f.profile_id, f.attempt_created_at
            ),
            
            -- Stagnation Rate Data Points
            header_stagnation_points AS (
                SELECT 
                    ''::text AS profile_id,
                    to_char(gs.created_at, 'YYYY-MM-DD') AS date,
                    (sf.stagnated * 100)::int AS value,
                    ''::text AS attempt_id,
                    ''::text AS simulation_id,
                    ''::text AS scenario_id
                FROM stagnation_flags sf
                JOIN grade_stream gs ON gs.id = sf.id
                ORDER BY gs.created_at
            ),
            
            -- Time Spent Data Points
            header_time_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    ROUND(LEAST(30.0, f.time_taken_seconds / 60.0))::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                WHERE f.time_taken_seconds IS NOT NULL
                ORDER BY f.profile_id, f.attempt_created_at
            ),
            
            -- Total Attempts Data Points
            header_attempts_points AS (
                SELECT 
                    f.profile_id::text AS profile_id,
                    to_char(f.attempt_created_at, 'YYYY-MM-DD') AS date,
                    1::int AS value,
                    f.attempt_id::text AS attempt_id,
                    f.simulation_id::text AS simulation_id,
                    f.scenario_id::text AS scenario_id
                FROM filt f
                WHERE f.attempt_id IS NOT NULL
                ORDER BY f.profile_id, f.attempt_created_at
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
            growth_completion_rate AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       AVG(CASE WHEN expected > 0 THEN (100.0 * completed_chats / expected) ELSE 0 END)::float AS value
                FROM attempt_norm
                GROUP BY date
            ),
            growth_first_attempt_pass_rate AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       (100.0 * COUNT(*) FILTER (WHERE grade_percent >= (rubric_pass_points * 100.0 / NULLIF(rubric_points, 0))) 
                        / NULLIF(COUNT(*), 0))::float AS value
                FROM first_attempts
                GROUP BY date
            ),
            growth_messages AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       AVG(num_messages_total)::float AS value
                FROM filt WHERE num_messages_total IS NOT NULL
                GROUP BY date
            ),
            growth_persona_times_daily AS (
                SELECT to_char(pt.attempt_created_at, 'YYYY-MM-DD') AS date,
                       AVG(pt.delta_sec)::float AS value
                FROM (
                    SELECT attempt_created_at, UNNEST(message_time_taken_seconds) AS delta_sec
                    FROM filt WHERE cardinality(message_time_taken_seconds) > 0
                ) pt
                GROUP BY date
            ),
            growth_efficiency AS (
                SELECT 
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    GREATEST(0, LEAST(100, ROUND(
                        AVG(grade_percent) FILTER (WHERE grade_percent IS NOT NULL) * 
                        (1.0 - LEAST(1.0, (SUM(time_taken_seconds / 60.0) FILTER (WHERE time_taken_seconds IS NOT NULL) / 
                         NULLIF(COUNT(DISTINCT chat_id), 0)) / 120.0))
                    )))::float AS value
                FROM filt 
                WHERE time_taken_seconds > 0 AND grade_percent IS NOT NULL
                GROUP BY date
            ),
            growth_stagnation AS (
                SELECT to_char(created_at, 'YYYY-MM-DD') AS date,
                       (100.0 * AVG(stagnated))::float AS value
                FROM stagnation_flags
                GROUP BY date
            ),
            growth_time_spent AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       AVG(time_taken_seconds)::float AS value
                FROM filt WHERE time_taken_seconds IS NOT NULL
                GROUP BY date
            ),
            growth_total_attempts AS (
                SELECT to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                       COUNT(DISTINCT attempt_id)::float AS value
                FROM filt
                GROUP BY date
            ),
            growth_chart_dates AS (
                SELECT s.d AS date_val,
                       to_char(s.d, 'YYYY-MM-DD') AS date,
                       ROUND(COALESCE(gas.value, 0))::int AS average_score,
                       ROUND(COALESCE(gcr.value, 0))::int AS completion_rate,
                       ROUND(COALESCE(gfapr.value, 0))::int AS first_attempt_pass_rate,
                       ROUND(COALESCE(ge.value, 0))::int AS session_efficiency,
                       ROUND(COALESCE(gst.value, 0))::int AS stagnation_rate
                FROM spine s
                LEFT JOIN growth_avg_score gas ON gas.date = to_char(s.d, 'YYYY-MM-DD')
                LEFT JOIN growth_completion_rate gcr ON gcr.date = to_char(s.d, 'YYYY-MM-DD')
                LEFT JOIN growth_first_attempt_pass_rate gfapr ON gfapr.date = to_char(s.d, 'YYYY-MM-DD')
                LEFT JOIN growth_efficiency ge ON ge.date = to_char(s.d, 'YYYY-MM-DD')
                LEFT JOIN growth_stagnation gst ON gst.date = to_char(s.d, 'YYYY-MM-DD')
                WHERE gas.value IS NOT NULL 
                   OR gcr.value IS NOT NULL 
                   OR gfapr.value IS NOT NULL 
                   OR ge.value IS NOT NULL 
                   OR gst.value IS NOT NULL
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
                       ARRAY_AGG(DISTINCT f.simulation_id::text) AS simulation_ids,
                       CASE
                           WHEN AVG(f.grade_percent)::float >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                           WHEN AVG(f.grade_percent)::float >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                           ELSE 'danger'
                       END AS status
                FROM filt f
                JOIN personas p ON p.id = f.persona_id
                WHERE f.grade_percent IS NOT NULL AND f.persona_id IS NOT NULL
                GROUP BY f.persona_id, p.name, p.color
            ),
            trend_data_raw AS (
                SELECT
                    f.persona_id,
                    date_trunc('day', f.chat_created_at) AS day,
                    to_char(date_trunc('day', f.chat_created_at), 'YYYY-MM-DD') AS date,
                    EXTRACT(epoch FROM date_trunc('day', f.chat_created_at))::bigint AS timestamp,
                    f.simulation_id,
                    AVG(f.grade_percent)::float AS avg_score
                FROM filt f
                WHERE f.persona_id IS NOT NULL AND f.grade_percent IS NOT NULL
                GROUP BY f.persona_id, date_trunc('day', f.chat_created_at), f.simulation_id
            ),
            persona_trends_agg AS (
                SELECT 
                    persona_id,
                    COALESCE(json_agg(json_build_object(
                        'date', date,
                        'score', ROUND(COALESCE(avg_score, 0))::int,
                        'timestamp', timestamp,
                        'simulationId', simulation_id::text
                    ) ORDER BY day), '[]'::json) AS trends
                FROM trend_data_raw
                GROUP BY persona_id
            ),
            persona_colors_agg AS (
                SELECT json_object_agg(
                    p.name,
                    COALESCE(p.color, '#3b82f6')
                ) AS colors
                FROM (SELECT DISTINCT persona_id FROM persona_agg) pa
                JOIN personas p ON p.id = pa.persona_id
            ),
            
            -- Rubric Heatmap (FULL IMPLEMENTATION with correlation matrices)
            filtered_chats AS (
                SELECT DISTINCT chat_id
                FROM filt
                WHERE chat_id IS NOT NULL
            ),
            latest_grade_per_chat AS (
                SELECT DISTINCT ON (c.id)
                    scg.id,
                    c.id AS chat_id,
                    scg.rubric_id
                FROM grades scg
                JOIN runs r ON r.id = scg.run_id
                JOIN group_runs gr ON gr.run_id = r.id
                JOIN groups g ON g.id = gr.group_id
                JOIN chat_groups cg ON cg.group_id = g.id
                JOIN chats c ON c.id = cg.chat_id
                JOIN filtered_chats fc ON fc.chat_id = c.id
                WHERE EXISTS (
                    SELECT 1 FROM runs r_check
                    JOIN group_runs gr_check ON gr_check.run_id = r_check.id
                    JOIN groups g_check ON g_check.id = gr_check.group_id
                    JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
                    JOIN chats c_check ON c_check.id = cg_check.chat_id
                    WHERE r_check.id = scg.run_id
                )
                ORDER BY c.id, scg.created_at DESC
            ),
            per_grade_group AS (
                SELECT
                    lg.chat_id,
                    sg.rubric_id,
                    sg.id AS group_id,
                    sg.name AS group_name,
                    (100.0 * SUM(scf.total)::float8 / NULLIF(sg.points::float8, 0))::float8 AS pct
                FROM latest_grade_per_chat lg
                JOIN feedbacks scf ON scf.grade_id = lg.id
                JOIN standards s ON s.id = scf.standard_id
                JOIN rubric_standard_groups rsg ON rsg.rubric_id = lg.rubric_id AND rsg.active = true
                JOIN standard_groups sg ON sg.id = rsg.standard_group_id AND sg.id = s.standard_group_id
                GROUP BY lg.chat_id, rsg.rubric_id, sg.id, sg.name, sg.points
            ),
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
            corrs_full AS (
                SELECT rubric_id, g1, g2, n, r FROM corrs_upper
                UNION ALL
                SELECT rubric_id, g2 AS g1, g1 AS g2, n, r
                FROM corrs_upper
                WHERE g1 != g2
            ),
            rubric_groups AS (
                SELECT DISTINCT pgg.rubric_id, sg.id, sg.name, sg.short_name
                FROM per_grade_group pgg
                JOIN standard_groups sg ON sg.id = pgg.group_id
            ),
            valid_rubric_ids_list AS (
                SELECT DISTINCT rubric_id FROM rubric_groups
            ),
            enriched_corrs AS (
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
                FROM rubric_groups g1
                JOIN rubric_groups g2 ON g2.rubric_id = g1.rubric_id
                LEFT JOIN enriched_corrs e
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
                FROM rubric_groups
                GROUP BY rubric_id
            ),
            rubric_insights AS (
                SELECT
                    e.rubric_id,
                    CASE
                        WHEN COALESCE(SUM(CASE WHEN e.n >= 3 THEN 1 ELSE 0 END), 0) = 0 THEN NULL
                        ELSE (
                            SELECT 'Top pair: "' || g1.name || '" vs "' || g2.name ||
                                   '" r=' || TO_CHAR(e2.r, 'FM0.00') ||
                                   ' (n=' || e2.n || ')'
                            FROM enriched_corrs e2
                            JOIN rubric_groups g1 ON g1.id = e2.g1 AND g1.rubric_id = e2.rubric_id
                            JOIN rubric_groups g2 ON g2.id = e2.g2 AND g2.rubric_id = e2.rubric_id
                            WHERE e2.rubric_id = e.rubric_id AND e2.n >= 3
                            ORDER BY ABS(e2.r) DESC, e2.n DESC
                            LIMIT 1
                        )
                    END AS txt
                FROM enriched_corrs e
                GROUP BY e.rubric_id
            ),
            rubric_has_data AS (
                SELECT rubric_id,
                    (SUM(CASE WHEN n >= 3 THEN 1 ELSE 0 END) > 0) AS has_data
                FROM enriched_corrs
                GROUP BY rubric_id
            ),
            rubric_avg_correlation AS (
                SELECT 
                    rubric_id,
                    AVG(ABS(r)) AS avg_correlation_strength
                FROM enriched_corrs
                WHERE g1 != g2 AND n >= 3
                GROUP BY rubric_id
            ),
            per_rubric_heatmap AS (
                SELECT
                    r.rubric_id,
                    COALESCE(m.matrix, '[]'::json) AS matrix,
                    COALESCE(sg.standard_groups, '[]'::json) AS standard_groups,
                    (SELECT txt FROM rubric_insights i WHERE i.rubric_id = r.rubric_id LIMIT 1) AS insights,
                    COALESCE((SELECT h.has_data FROM rubric_has_data h WHERE h.rubric_id = r.rubric_id LIMIT 1), FALSE) AS has_data
                FROM valid_rubric_ids_list r
                LEFT JOIN matrix_json m ON m.rubric_id = r.rubric_id
                LEFT JOIN sg_json sg ON sg.rubric_id = r.rubric_id
            ),
            rubric_correlations AS (
                SELECT json_build_object(
                    'matrices', COALESCE(
                        (SELECT json_agg(json_build_object(
                            'rubricId', pr.rubric_id::text,
                            'standardGroups', pr.standard_groups,
                            'matrix', pr.matrix,
                            'insights', pr.insights,
                            'hasData', pr.has_data
                        ) ORDER BY pr.rubric_id::text) FROM per_rubric_heatmap pr),
                        '[]'::json
                    ),
                    'validRubricIds', COALESCE(
                        (SELECT json_agg(rubric_id::text ORDER BY rubric_id::text) FROM valid_rubric_ids_list),
                        '[]'::json
                    ),
                    'status', CASE
                        WHEN (SELECT COUNT(*) FROM rubric_avg_correlation) = 0 THEN 'neutral'
                        WHEN (SELECT AVG(avg_correlation_strength * 100) FROM rubric_avg_correlation) >= 
                             (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                        WHEN (SELECT AVG(avg_correlation_strength * 100) FROM rubric_avg_correlation) >= 
                             (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                        ELSE 'danger'
                    END
                ) AS rubric_data
            ),
            
            -- =====================================================
            -- SECONDARY METRICS
            -- =====================================================
            
            -- Attempt Improvement (ENHANCED with per-simulation facts)
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
            attempt_stats AS (
                SELECT
                    ao.profile_id,
                    ao.simulation_id,
                    ao.attempt_id,
                    ao.attempt_no,
                    AVG(f.grade_percent)::float AS avg_grade,
                    AVG(f.time_taken_seconds / 60.0)::float AS avg_time_minutes,
                    MAX((f.passed)::int)::int AS passed_any
                FROM attempt_ord ao
                JOIN filt f ON f.attempt_id = ao.attempt_id
                WHERE f.grade_percent IS NOT NULL
                GROUP BY ao.profile_id, ao.simulation_id, ao.attempt_id, ao.attempt_no
            ),
            multiple_users_attempt_data AS (
                SELECT
                    simulation_id,
                    attempt_no,
                    AVG(avg_grade)::float AS avg_grade,
                    AVG(avg_time_minutes)::float AS avg_time_minutes,
                    (100.0 * AVG(passed_any))::float AS pass_rate
                FROM attempt_stats
                WHERE avg_grade IS NOT NULL
                GROUP BY simulation_id, attempt_no
            ),
            attempt_rows AS (
                SELECT
                    attempt_no,
                    AVG(avg_grade)::float AS avg_grade,
                    AVG(avg_time_minutes)::float AS avg_time_minutes,
                    AVG(pass_rate)::float AS pass_rate
                FROM multiple_users_attempt_data
                WHERE attempt_no <= 5
                GROUP BY attempt_no
            ),
            attempt_facts AS (
                SELECT
                    simulation_id::text,
                    attempt_no::int,
                    ROUND(COALESCE(avg_grade, 0))::int AS avg_grade,
                    ROUND(COALESCE(avg_time_minutes, 0))::int AS avg_minutes,
                    ROUND(COALESCE(pass_rate, 0))::int AS pass_rate
                FROM multiple_users_attempt_data
            ),
            
            -- Cohort Performance (FULL IMPLEMENTATION)
            filt_with_cohorts AS (
                SELECT f.*, c_id
                FROM filt f,
                LATERAL unnest(f.cohort_ids) AS c_id
            ),
            cohort_list AS (
                SELECT DISTINCT 
                    c.id, 
                    c.title,
                    ARRAY(
                        SELECT cp.profile_id 
                        FROM cohort_profiles cp
                        JOIN profiles p ON p.id = cp.profile_id
                        WHERE cp.cohort_id = c.id
                            AND cp.active = true  -- Only active cohort memberships for non-history queries
                            AND p.role = ANY($4::profile_role[])
                    ) AS profile_ids,
                    ARRAY(SELECT cs.simulation_id FROM cohort_simulations cs WHERE cs.cohort_id = c.id) AS simulation_ids
                FROM cohorts c
                JOIN (SELECT DISTINCT c_id FROM filt_with_cohorts) fc ON fc.c_id = c.id
            ),
            cohort_attempts AS (
                SELECT
                    fc.c_id AS cohort_id,
                    fc.attempt_id,
                    MAX((fc.passed)::int)::int AS passed_any,
                    AVG(fc.grade_percent)::float AS avg_grade_attempt
                FROM filt_with_cohorts fc
                GROUP BY fc.c_id, fc.attempt_id
            ),
            cohort_agg AS (
                SELECT
                    cl.id AS cohort_id,
                    cl.title AS cohort_name,
                    COALESCE(cardinality(cl.profile_ids), 0) AS total_students_declared,
                    cardinality(cl.profile_ids) AS total_students_seen,
                    COUNT(DISTINCT ca.attempt_id) AS total_attempts,
                    SUM(ca.passed_any)::int AS passed_attempts,
                    (100.0 * AVG(ca.passed_any))::float AS pass_rate_attempts,
                    AVG(ca.avg_grade_attempt)::float AS avg_percentage_score,
                    (SELECT COUNT(*) FROM (
                        SELECT profile_id
                        FROM filt_with_cohorts fc2
                        WHERE fc2.c_id = cl.id
                        GROUP BY profile_id
                        HAVING 
                            COUNT(DISTINCT simulation_id) = cardinality(cl.simulation_ids)
                            AND NOT EXISTS (
                                SELECT 1 
                                FROM (
                                    SELECT 
                                        simulation_id,
                                        MAX(CASE WHEN grade_percent IS NULL THEN 0 ELSE grade_percent END) as best_score
                                    FROM filt_with_cohorts fc3 
                                    WHERE fc3.c_id = cl.id 
                                        AND fc3.profile_id = fc2.profile_id
                                    GROUP BY simulation_id
                                ) sim_bests
                                WHERE sim_bests.best_score < 80.0
                            )
                    ) s) AS passed_students,
                    (SELECT COUNT(*) FROM (
                        SELECT 1
                        FROM filt_with_cohorts fc2
                        WHERE fc2.c_id = cl.id
                        GROUP BY fc2.profile_id
                        HAVING MAX((fc2.passed)::int) = 1
                    ) s) AS passed_at_least_once,
                    cardinality(cl.simulation_ids) AS simulation_count,
                    cardinality(cl.simulation_ids) AS required_simulations
                FROM cohort_list cl
                LEFT JOIN cohort_attempts ca ON ca.cohort_id = cl.id
                GROUP BY cl.id, cl.title, cl.profile_ids, cl.simulation_ids
            ),
            cohort_daily_data AS (
                SELECT
                    to_char(date_trunc('day', fc.chat_created_at), 'MM/DD') AS date,
                    AVG(fc.grade_percent)::float AS avg_score,
                    fc.c_id::text AS cohort_id
                FROM filt_with_cohorts fc
                WHERE fc.grade_percent IS NOT NULL
                GROUP BY fc.c_id, date_trunc('day', fc.chat_created_at)
            ),
            
            -- Skill Performance (FULL IMPLEMENTATION with radar charts)
            filt_for_skills AS (
                SELECT chat_id, simulation_id, cohort_ids, profile_cohort_ids, profile_role,
                       is_general, is_practice, is_archived, profile_id, chat_created_at
                FROM analytics a
                WHERE a.chat_created_at >= $1
                    AND a.chat_created_at < $2
                    -- Filter by simulation_ids from cohorts (new filtering order)
                    AND (cardinality($3::uuid[]) = 0 OR a.simulation_id IN (SELECT simulation_id FROM filtered_simulation_ids))
                    -- Dashboard never filters by profile - always filter by roles
                    AND a.profile_role = ANY($4::profile_role[])
                    -- Filter by department_ids (empty array = all departments)
                    AND (cardinality($6::uuid[]) = 0 OR a.department_id = ANY($6::uuid[]))
                    AND ($5::text[] IS NULL OR cardinality($5::text[]) > 0)
                    AND (
                        $5::text[] IS NULL OR (
                            ('general'  = ANY ($5::text[]) AND a.is_general)  OR
                            ('practice' = ANY ($5::text[]) AND a.is_practice) OR
                            ('archived' = ANY ($5::text[]) AND a.is_archived)
                        )
                    )
                    -- Exclude archived attempts unless 'archived' is explicitly in the filter list
                    AND (
                        'archived' = ANY($5::text[]) OR a.is_archived = FALSE
                    )
            ),
            latest_grade_for_skills AS (
                SELECT DISTINCT ON (c.id, scg.rubric_id)
                       scg.id AS grade_id,
                       c.id AS chat_id,
                       scg.rubric_id,
                       scg.created_at
                FROM grades scg
                JOIN runs r ON r.id = scg.run_id
                JOIN group_runs gr ON gr.run_id = r.id
                JOIN groups g ON g.id = gr.group_id
                JOIN chat_groups cg ON cg.group_id = g.id
                JOIN chats c ON c.id = cg.chat_id
                WHERE EXISTS (
                    SELECT 1 FROM runs r_check
                    JOIN group_runs gr_check ON gr_check.run_id = r_check.id
                    JOIN groups g_check ON g_check.id = gr_check.group_id
                    JOIN chat_groups cg_check ON cg_check.group_id = g_check.id
                    JOIN chats c_check ON c_check.id = cg_check.chat_id
                    WHERE r_check.id = scg.run_id
                )
                ORDER BY c.id, scg.rubric_id, scg.created_at DESC
            ),
            per_grade_group_skills AS (
                SELECT
                    lg.rubric_id,
                    sg.id AS group_id,
                    sg.name AS group_name,
                    f.simulation_id,
                    lg.grade_id AS grade_id,
                    SUM(scf.total)::float8 AS score,
                    SUM(s.points)::float8 AS points,
                    CASE WHEN sg.points > 0
                         THEN 100.0 * SUM(scf.total)::float8 / sg.points::float8
                         ELSE NULL
                    END AS pct
                FROM latest_grade_for_skills lg
                JOIN filt_for_skills f ON f.chat_id = lg.chat_id
                JOIN feedbacks scf ON scf.grade_id = lg.grade_id
                JOIN standards s ON s.id = scf.standard_id
                JOIN rubric_standard_groups rsg ON rsg.rubric_id = lg.rubric_id AND rsg.active = true
                JOIN standard_groups sg ON sg.id = rsg.standard_group_id AND sg.id = s.standard_group_id
                GROUP BY lg.rubric_id, sg.id, sg.name, f.simulation_id, lg.grade_id, sg.points
            ),
            radar_rows AS (
                SELECT 
                    pgg.rubric_id, 
                    sg.short_name AS group_name,
                    sg.description AS group_description,
                    AVG(pgg.pct)::float8 AS avg_pct
                FROM per_grade_group_skills pgg
                JOIN standard_groups sg ON sg.id = pgg.group_id
                GROUP BY pgg.rubric_id, sg.short_name, sg.description
            ),
            radar_per_rubric AS (
                SELECT
                    rubric_id,
                    json_agg(
                        json_build_object(
                            'metric', group_name,
                            'description', group_description,
                            'value', GREATEST(0, LEAST(1, COALESCE(avg_pct, 0) / 100.0)),
                            'fullMark', 1
                        )
                        ORDER BY group_name
                    ) AS radar
                FROM radar_rows
                GROUP BY rubric_id
            ),
            skill_group_stats AS (
                SELECT
                    pgg.rubric_id,
                    sg.id AS group_id,
                    sg.name AS group_name,
                    sg.description AS group_description,
                    pgg.simulation_id,
                    SUM(pgg.score) AS score_sum,
                    SUM(pgg.points) AS points_sum,
                    ROUND(AVG(pgg.pct))::int AS avg_pct
                FROM per_grade_group_skills pgg
                JOIN standard_groups sg ON sg.id = pgg.group_id
                GROUP BY pgg.rubric_id, sg.id, sg.name, sg.description, pgg.simulation_id
            ),
            skill_facts_per_rubric AS (
                SELECT
                    rubric_id,
                    json_agg(
                        json_build_object(
                            'groupId', group_id::text,
                            'groupName', group_name,
                            'groupDescription', group_description,
                            'simulationId', simulation_id::text,
                            'score', COALESCE(score_sum, 0),
                            'points', COALESCE(points_sum, 0),
                            'avgPct', COALESCE(avg_pct, 0)
                        )
                        ORDER BY group_name, simulation_id
                    ) AS facts
                FROM skill_group_stats
                GROUP BY rubric_id
            ),
            skill_valid_rubrics AS (
                SELECT DISTINCT rubric_id FROM per_grade_group_skills
            ),
            
            -- =====================================================
            -- FOOTER METRICS
            -- =====================================================
            
            -- Scenario Performance (FULL IMPLEMENTATION with categorical parameters)
            param_ids_categorical AS (
                SELECT id
                FROM parameters
                WHERE active = TRUE
            ),
            cat_map AS (
                SELECT 
                    f.id AS parameter_item_id,
                    fp.parameter_id,
                    s.id AS scenario_id
                FROM fields f
                JOIN parameter_fields fp ON fp.field_id = f.id AND fp.active = true
                JOIN param_ids_categorical p ON p.id = fp.parameter_id
                JOIN scenario_fields sf ON sf.field_id = f.id
                JOIN scenarios s ON s.id = sf.scenario_id
                WHERE s.active = TRUE
            ),
            scenario_seen AS (
                SELECT DISTINCT f.scenario_id
                FROM filt f
                WHERE f.scenario_id IS NOT NULL
            ),
            cat_map_seen AS (
                SELECT cm.parameter_id, cm.parameter_item_id, cm.scenario_id
                FROM cat_map cm
                JOIN scenario_seen ss ON ss.scenario_id = cm.scenario_id
            ),
            attempt_daily_categorical AS (
                SELECT
                    cm.parameter_id,
                    cm.parameter_item_id,
                    to_char(date_trunc('day', f.chat_created_at), 'YYYY-MM-DD') AS date,
                    EXTRACT(EPOCH FROM date_trunc('day', f.chat_created_at))::bigint AS ts,
                    AVG(f.grade_percent)::float AS avg_score,
                    COUNT(*)::int AS attempts,
                    SUM((f.passed)::int)::int AS passed_attempts
                FROM filt f
                JOIN cat_map_seen cm ON cm.scenario_id = f.scenario_id
                WHERE f.grade_percent IS NOT NULL
                GROUP BY cm.parameter_id, cm.parameter_item_id, date_trunc('day', f.chat_created_at)
            ),
            valid_categorical_params AS (
                SELECT DISTINCT parameter_id FROM cat_map_seen
            ),
            
            -- Scenario Stats (NUMERICAL PARAMETERS REMOVED - functionality disabled)
            -- Note: Numerical parameters and value field have been removed
            -- This section is commented out until alternative implementation is provided
            /*
            nums AS (
                SELECT id
                FROM parameters
                WHERE active = TRUE
            ),
            num_map AS (
                SELECT 
                    s.id AS scenario_id, 
                    pf.parameter_id, 
                    NULL::numeric AS level  -- Value field removed, level extraction from name not implemented
                FROM scenarios s
                JOIN scenario_fields sf ON sf.scenario_id = s.id
                JOIN fields f ON f.id = sf.field_id
                JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
                JOIN nums n ON n.id = pf.parameter_id
                WHERE s.active = TRUE
            ),
            */
            -- Empty CTEs to maintain query structure
            nums AS (SELECT id FROM parameters WHERE false),
            num_map AS (SELECT NULL::uuid AS scenario_id, NULL::uuid AS parameter_id, NULL::numeric AS level WHERE false),
            num_map_seen AS (
                SELECT nm.*
                FROM num_map nm
                JOIN scenario_seen ss ON ss.scenario_id = nm.scenario_id
            ),
            numeric_attempts AS (
                SELECT
                    nms.parameter_id,
                    nms.level,
                    f.grade_percent::float AS score
                FROM filt f
                JOIN num_map_seen nms ON nms.scenario_id = f.scenario_id
                WHERE f.grade_percent IS NOT NULL
            ),
            numeric_levels AS (
                SELECT
                    parameter_id,
                    CASE 
                        WHEN level = floor(level) THEN level::int::text 
                        ELSE to_char(level, 'FM999D0') 
                    END AS level_label,
                    CASE 
                        WHEN level = floor(level) THEN level::numeric 
                        ELSE round(level::numeric, 1) 
                    END AS level_value,
                    score
                FROM numeric_attempts
            ),
            numeric_agg AS (
                SELECT 
                    parameter_id, 
                    level_label, 
                    level_value,
                    AVG(score)::float AS avg_score,
                    COUNT(*)::int AS attempts
                FROM numeric_levels
                GROUP BY parameter_id, level_label, level_value
            ),
            valid_numeric_params AS (
                SELECT DISTINCT parameter_id FROM numeric_levels
            ),
            
            -- Simulation Performance (existing, keep as-is)
            sim_perf AS (
                SELECT f.simulation_id,
                       f.scenario_id,
                       sc.name AS scenario_name,
                       COALESCE(AVG(f.grade_percent), 0)::float AS avg_score,
                       COALESCE((100.0 * AVG((f.completed OR f.grade_percent IS NOT NULL)::int)), 0)::float AS success_rate,
                       COUNT(*)::int AS total_attempts,
                       SUM((f.completed OR f.grade_percent IS NOT NULL)::int)::int AS completed_attempts
                FROM filt f
                JOIN scenarios sc ON sc.id = f.scenario_id
                WHERE f.simulation_id IS NOT NULL AND f.scenario_id IS NOT NULL
                GROUP BY f.simulation_id, f.scenario_id, sc.name
            ),
            
            -- Simulation Composition (ENHANCED with parameter composition)
            sim_seen AS (
                SELECT DISTINCT f.simulation_id
                FROM filt f
                WHERE f.simulation_id IS NOT NULL
            ),
            scen_seen AS (
                SELECT DISTINCT f.scenario_id
                FROM filt f
                WHERE f.scenario_id IS NOT NULL
            ),
            sim_summary AS (
                SELECT
                    f.simulation_id,
                       AVG(f.grade_percent)::float AS avg_score,
                    (100.0 * AVG((f.passed)::int))::float AS pass_rate,
                    (100.0 * AVG((f.completed OR f.grade_percent IS NOT NULL)::int))::float AS completion_rate,
                       COUNT(*)::int AS attempts
                FROM filt f
                WHERE f.grade_percent IS NOT NULL
                GROUP BY f.simulation_id
            ),
            sim_scenarios_seen AS (
                SELECT 
                    s.id AS simulation_id,
                    COUNT(DISTINCT sc.id)::int AS scenario_count
                FROM simulations s
                JOIN simulation_scenarios ss_link ON ss_link.simulation_id = s.id
                JOIN scenarios sc ON sc.id = ss_link.scenario_id
                JOIN scen_seen ss ON ss.scenario_id = sc.id
                WHERE s.active = TRUE AND sc.active = TRUE
                GROUP BY s.id
            ),
            sim_param_items_seen AS (
                SELECT
                    s.id AS simulation_id,
                    p.id AS parameter_id,
                    f.id AS parameter_item_id,
                    COUNT(a.chat_id)::int AS cnt
                FROM simulations s
                JOIN simulation_scenarios ss_link ON ss_link.simulation_id = s.id
                JOIN scenarios sc ON sc.id = ss_link.scenario_id
                JOIN scen_seen ss ON ss.scenario_id = sc.id
                JOIN scenario_fields sf ON sf.scenario_id = sc.id
                JOIN fields f ON f.id = sf.field_id
                JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
                JOIN parameters p ON p.id = pf.parameter_id
                JOIN analytics a ON a.scenario_id = sc.id
                WHERE s.active = TRUE AND sc.active = TRUE
                GROUP BY s.id, p.id, f.id
            ),
            -- Numerical parameter stats removed (value field no longer exists)
            sim_param_nums_seen AS (
                SELECT
                    NULL::uuid AS simulation_id,
                    NULL::uuid AS parameter_id,
                    NULL::numeric AS most_common_level,
                    0::int AS chat_count
                WHERE false
            ),
            sim_param_nums_most_common AS (
                SELECT
                    simulation_id,
                    parameter_id,
                    most_common_level,
                    chat_count,
                    ROW_NUMBER() OVER (
                        PARTITION BY simulation_id, parameter_id 
                        ORDER BY chat_count DESC, most_common_level DESC
                    ) as rn
                FROM sim_param_nums_seen
            ),
            simulation_facts AS (
                SELECT
                    s.id AS simulation_id,
                    s.title AS simulation_title,
                    COALESCE(ROUND(ss.avg_score), 0)::int AS avg_score,
                    COALESCE(ROUND(ss.pass_rate), 0)::int AS pass_rate,
                    COALESCE(ROUND(ss.completion_rate), 0)::int AS completion_rate,
                    COALESCE(ss.attempts, 0) AS total_attempts,
                    COALESCE(sc_seen.scenario_count, 0) AS scenario_count
                FROM simulations s
                LEFT JOIN sim_summary ss ON ss.simulation_id = s.id
                LEFT JOIN sim_scenarios_seen sc_seen ON sc_seen.simulation_id = s.id
                WHERE s.active = TRUE
                  AND s.id IN (SELECT simulation_id FROM sim_seen)
            ),
            param_facts_cat AS (
                SELECT
                    simulation_id,
                    parameter_id,
                    parameter_item_id,
                    cnt AS scenario_count
                FROM sim_param_items_seen
            ),
            param_facts_num AS (
                SELECT
                    simulation_id,
                    parameter_id,
                    most_common_level AS avg_level,
                    CASE
                        WHEN most_common_level = floor(most_common_level) 
                        THEN (most_common_level::int)::text
                        ELSE to_char(most_common_level, 'FM999D0')
                    END AS level_label,
                    chat_count AS scenario_count
                FROM sim_param_nums_most_common
                WHERE rn = 1
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
                    jsonb_build_object(
                        'name', s.title, 
                        'description', COALESCE(s.description, ''),
                        'time_limit', COALESCE(
                            (SELECT SUM(stl.time_limit_seconds)
                             FROM scenario_time_limits stl
                             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
                             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
                            0
                        )
                    )
                ), '{}'::jsonb) AS mapping
                FROM simulations s
                LEFT JOIN simulation_departments sd ON sd.simulation_id = s.id AND sd.active = true
                WHERE s.id IN (SELECT simulation_id FROM simulation_ids)
                  AND s.active = true
                  AND (
                      cardinality($6::uuid[]) = 0 
                      OR sd.department_id = ANY($6::uuid[])
                      OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = s.id AND sd2.active = true)
                  )
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
                    jsonb_build_object(
                        'name', p.name, 
                        'description', COALESCE(p.description, ''),
                        'document_parameter', p.document_parameter
                    )
                ), '{}'::jsonb) AS mapping
                FROM parameters p
                WHERE p.active = true
                  AND (
                      cardinality($6::uuid[]) = 0 
                      OR EXISTS (
                          SELECT 1 
                          FROM fields f
                          JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
                          JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
                          WHERE pf.parameter_id = p.id AND fd.department_id = ANY($6::uuid[])
                      )
                      OR NOT EXISTS (
                          SELECT 1 
                          FROM fields f
                          JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
                          JOIN field_departments fd2 ON fd2.field_id = f.id AND fd2.active = true
                          WHERE pf.parameter_id = p.id
                      )
                  )
            ),
            
            field_mapping AS (
                SELECT COALESCE(jsonb_object_agg(
                    f.id::text,
                    jsonb_build_object(
                        'name', f.name, 
                        'description', COALESCE(f.description, ''),
                        'parameterId', pf.parameter_id::text,
                        'parameterName', p.name
                    )
                ), '{}'::jsonb) AS mapping
                FROM fields f
                JOIN parameter_fields pf ON pf.field_id = f.id AND pf.active = true
                JOIN parameters p ON pf.parameter_id = p.id
                LEFT JOIN field_departments fd ON fd.field_id = f.id AND fd.active = true
                WHERE p.active = true
                  AND (
                      cardinality($6::uuid[]) = 0 
                      OR fd.department_id = ANY($6::uuid[])
                      OR NOT EXISTS (SELECT 1 FROM field_departments fd2 WHERE fd2.field_id = f.id AND fd2.active = true)
                  )
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
                        'trendData', COALESCE((SELECT json_agg(json_build_object('date', date, 'value', value, 'count', count)) FROM header_avg_score_trend), '[]'::json),
                        'dataPoints', COALESCE((SELECT json_agg(json_build_object('profileId', profile_id, 'date', date, 'value', value, 'attemptId', attempt_id, 'simulationId', simulation_id, 'scenarioId', scenario_id)) FROM header_avg_score_points), '[]'::json)
                    ),
                    'completionPercentage', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_completion), false),
                        'method', 'avg',
                        'currentValue', COALESCE((SELECT current_value FROM header_completion), 0),
                        'trendData', COALESCE((SELECT json_agg(json_build_object('date', date, 'value', value, 'count', count)) FROM header_completion_trend), '[]'::json),
                        'dataPoints', COALESCE((SELECT json_agg(json_build_object('profileId', profile_id, 'date', date, 'value', value, 'attemptId', attempt_id, 'simulationId', simulation_id, 'scenarioId', scenario_id)) FROM header_completion_points), '[]'::json)
                    ),
                    'firstAttemptPassRate', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_first_pass), false),
                        'method', 'rate',
                        'currentValue', COALESCE((SELECT current_value FROM header_first_pass), 0),
                        'trendData', COALESCE((SELECT json_agg(json_build_object('date', date, 'value', value, 'count', count)) FROM header_first_pass_trend), '[]'::json),
                        'dataPoints', COALESCE((SELECT json_agg(json_build_object('profileId', profile_id, 'date', date, 'value', value, 'attemptId', attempt_id, 'simulationId', simulation_id, 'scenarioId', scenario_id)) FROM header_first_pass_points), '[]'::json)
                    ),
                    'highestScore', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_highest), false),
                        'method', 'max',
                        'currentValue', COALESCE((SELECT current_value FROM header_highest), 0),
                        'trendData', COALESCE((SELECT json_agg(json_build_object('date', date, 'value', value, 'count', count)) FROM header_highest_trend), '[]'::json),
                        'dataPoints', COALESCE((SELECT json_agg(json_build_object('profileId', profile_id, 'date', date, 'value', value, 'attemptId', attempt_id, 'simulationId', simulation_id, 'scenarioId', scenario_id)) FROM header_highest_points), '[]'::json)
                    ),
                    'messagesPerSession', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_messages), false),
                        'method', 'avg',
                        'currentValue', COALESCE((SELECT current_value FROM header_messages), 0),
                        'trendData', COALESCE((SELECT json_agg(json_build_object('date', date, 'value', value, 'count', count)) FROM header_messages_trend), '[]'::json),
                        'dataPoints', COALESCE((SELECT json_agg(json_build_object('profileId', profile_id, 'date', date, 'value', value, 'attemptId', attempt_id, 'simulationId', simulation_id, 'scenarioId', scenario_id)) FROM header_messages_points), '[]'::json)
                    ),
                    'personaResponseTimes', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_persona_times), false),
                        'method', 'avg',
                        'currentValue', COALESCE((SELECT current_value FROM header_persona_times), 0),
                        'trendData', COALESCE((SELECT json_agg(json_build_object('date', date, 'value', value, 'count', count)) FROM header_persona_times_trend), '[]'::json),
                        'dataPoints', COALESCE((SELECT json_agg(json_build_object('profileId', profile_id, 'date', date, 'value', value, 'attemptId', attempt_id, 'simulationId', simulation_id, 'scenarioId', scenario_id)) FROM header_persona_times_points), '[]'::json)
                    ),
                    'sessionEfficiency', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_efficiency), false),
                        'method', 'avg',
                        'currentValue', COALESCE((SELECT current_value FROM header_efficiency), 0),
                        'trendData', COALESCE((SELECT json_agg(json_build_object('date', date, 'value', value, 'count', count)) FROM header_efficiency_trend), '[]'::json),
                        'dataPoints', COALESCE((SELECT json_agg(json_build_object('profileId', profile_id, 'date', date, 'value', value, 'attemptId', attempt_id, 'simulationId', simulation_id, 'scenarioId', scenario_id)) FROM header_efficiency_points), '[]'::json)
                    ),
                    'stagnationRate', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_stagnation), false),
                        'method', 'rate',
                        'currentValue', COALESCE((SELECT current_value FROM header_stagnation), 0),
                        'trendData', COALESCE((SELECT json_agg(json_build_object('date', date, 'value', value, 'count', count)) FROM header_stagnation_trend), '[]'::json),
                        'dataPoints', COALESCE((SELECT json_agg(json_build_object('profileId', profile_id, 'date', date, 'value', value, 'attemptId', attempt_id, 'simulationId', simulation_id, 'scenarioId', scenario_id)) FROM header_stagnation_points), '[]'::json)
                    ),
                    'timeSpent', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_time), false),
                        'method', 'avg',
                        'currentValue', COALESCE((SELECT current_value FROM header_time), 0),
                        'trendData', COALESCE((SELECT json_agg(json_build_object('date', date, 'value', value, 'count', count)) FROM header_time_trend), '[]'::json),
                        'dataPoints', COALESCE((SELECT json_agg(json_build_object('profileId', profile_id, 'date', date, 'value', value, 'attemptId', attempt_id, 'simulationId', simulation_id, 'scenarioId', scenario_id)) FROM header_time_points), '[]'::json)
                    ),
                    'totalAttempts', json_build_object(
                        'hasData', COALESCE((SELECT has_data FROM header_attempts), false),
                        'method', 'countDistinct',
                        'currentValue', COALESCE((SELECT current_value FROM header_attempts), 0),
                        'trendData', COALESCE((SELECT json_agg(json_build_object('date', date, 'value', value, 'count', count)) FROM header_attempts_trend), '[]'::json),
                        'dataPoints', COALESCE((SELECT json_agg(json_build_object('profileId', profile_id, 'date', date, 'value', value, 'attemptId', attempt_id, 'simulationId', simulation_id, 'scenarioId', scenario_id)) FROM header_attempts_points), '[]'::json)
                    )
                ),
                'primary', json_build_object(
                    'growthData', json_build_object(
                        'chartData', COALESCE((SELECT json_agg(json_build_object(
                            'date', date,
                            'averageScore', average_score,
                            'completionRate', completion_rate,
                            'firstAttemptPassRate', first_attempt_pass_rate,
                            'sessionEfficiency', session_efficiency,
                            'stagnationRate', stagnation_rate
                        ) ORDER BY date_val) FROM growth_chart_dates), '[]'::json),
                        'availableMetrics', json_build_array(
                            json_build_object(
                                'id', 'averageScore',
                                'name', 'Average Score',
                                'color', '#3b82f6',
                                'unit', '%',
                                'description', 'Average score across all attempts',
                                'formatterId', 'percent'
                            ),
                            json_build_object(
                                'id', 'completionRate',
                                'name', 'Completion Rate',
                                'color', '#8b5cf6',
                                'unit', '%',
                                'description', 'Percentage of scenarios completed',
                                'formatterId', 'percent'
                            ),
                            json_build_object(
                                'id', 'firstAttemptPassRate',
                                'name', 'First Attempt Pass Rate',
                                'color', '#06b6d4',
                                'unit', '%',
                                'description', 'Pass rate on first attempts',
                                'formatterId', 'percent'
                            ),
                            json_build_object(
                                'id', 'sessionEfficiency',
                                'name', 'Session Efficiency',
                                'color', '#84cc16',
                                'unit', '%',
                                'description', 'Efficiency index based on score and time (0-100)',
                                'formatterId', 'percent'
                            ),
                            json_build_object(
                                'id', 'stagnationRate',
                                'name', 'Stagnation Rate',
                                'color', '#ec4899',
                                'unit', '%',
                                'description', 'Percentage of attempts with no improvement',
                                'formatterId', 'percent'
                            )
                        ),
                        'windowAverages', json_build_object(
                            'averageScore', json_build_object(
                                'n', 7,
                                'last', (SELECT ROUND(last_avg) FROM growth_window),
                                'prev', (SELECT ROUND(prev_avg) FROM growth_window)
                            )
                        ),
                        'status', CASE
                            WHEN (SELECT last_avg FROM growth_window) IS NULL OR (SELECT prev_avg FROM growth_window) IS NULL THEN 'neutral'
                            WHEN (SELECT ROUND(last_avg - prev_avg) FROM growth_window) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                            WHEN (SELECT ROUND(last_avg - prev_avg) FROM growth_window) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                            ELSE 'danger'
                        END
                    ),
                    'personaPerformance', json_build_object(
                        'chartData', COALESCE((SELECT json_agg(json_build_object(
                            'name', sub.name,
                            'score', ROUND(COALESCE(sub.avg_score, 0))::int,
                            'sessions', sub.sessions,
                            'color', sub.color,
                            'simulationIds', sub.simulation_ids,
                            'trendData', COALESCE(sub.trends, '[]'::json),
                            'status', sub.status
                        )) FROM (
                            SELECT pa.name, pa.avg_score, pa.sessions, pa.color, pa.simulation_ids, pta.trends, pa.status
                            FROM persona_agg pa 
                            LEFT JOIN persona_trends_agg pta ON pta.persona_id = pa.persona_id
                            ORDER BY pa.avg_score DESC
                            LIMIT 5
                        ) sub), '[]'::json),
                        'validSimulationIds', COALESCE((
                            SELECT json_agg(DISTINCT simulation_id::text ORDER BY simulation_id::text) 
                            FROM filt WHERE simulation_id IS NOT NULL
                        ), '[]'::json),
                        'personaColors', COALESCE((SELECT colors FROM persona_colors_agg), '{}'::json)
                    ),
                    'rubricHeatmap', (SELECT rubric_data FROM rubric_correlations)
                ),
                'secondary', json_build_object(
                    'attemptImprovement', json_build_object(
                        'chartData', COALESCE((SELECT json_agg(json_build_object(
                            'attempt', 'Attempt ' || attempt_no,
                            'average_score', ROUND(COALESCE(avg_grade, 0))::int,
                            'average_time', ROUND(COALESCE(avg_time_minutes, 0))::int,
                            'pass_rate', ROUND(COALESCE(pass_rate, 0))::int
                        ) ORDER BY attempt_no) FROM attempt_rows), '[]'::json),
                        'facts', COALESCE((SELECT json_agg(json_build_object(
                            'simulationId', simulation_id,
                            'attemptNo', attempt_no,
                            'avgGrade', avg_grade,
                            'avgMinutes', avg_minutes,
                            'passRate', pass_rate
                        )) FROM attempt_facts), '[]'::json),
                        'validSimulationIds', COALESCE((
                            SELECT json_agg(DISTINCT simulation_id::text) FROM filt WHERE simulation_id IS NOT NULL
                        ), '[]'::json),
                        'status', CASE
                            WHEN (SELECT COUNT(*) FROM attempt_rows) < 2 THEN 'neutral'
                            WHEN (SELECT avg_grade FROM attempt_rows WHERE attempt_no = (SELECT MAX(attempt_no) FROM attempt_rows)) IS NULL 
                                 OR (SELECT avg_grade FROM attempt_rows WHERE attempt_no = (SELECT MIN(attempt_no) FROM attempt_rows)) IS NULL THEN 'neutral'
                            WHEN (SELECT avg_grade FROM attempt_rows WHERE attempt_no = (SELECT MAX(attempt_no) FROM attempt_rows)) - 
                                 (SELECT avg_grade FROM attempt_rows WHERE attempt_no = (SELECT MIN(attempt_no) FROM attempt_rows)) >= 
                                 (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                            WHEN (SELECT avg_grade FROM attempt_rows WHERE attempt_no = (SELECT MAX(attempt_no) FROM attempt_rows)) - 
                                 (SELECT avg_grade FROM attempt_rows WHERE attempt_no = (SELECT MIN(attempt_no) FROM attempt_rows)) >= 
                                 (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                            ELSE 'danger'
                        END
                    ),
                    'cohortPerformance', json_build_object(
                        'cohortData', COALESCE((SELECT json_agg(json_build_object(
                            'id', cohort_id::text,
                            'name', cohort_name,
                            'passRate', ROUND(
                                CASE 
                                    -- Dashboard mode: always use student-based pass rate (no profile_id filtering)
                                    WHEN total_students_seen > 0 THEN 
                                        (100.0 * passed_students / total_students_seen)::numeric
                                    ELSE 0
                                END, 2
                            )::float,
                            'avgPercentageScore', ROUND(COALESCE(avg_percentage_score, 0))::int,
                            'totalStudents', GREATEST(total_students_declared, total_students_seen),
                            'passedStudents', COALESCE(passed_at_least_once, 0),
                            'totalAttempts', COALESCE(total_attempts, 0),
                            'passedAttempts', COALESCE(passed_attempts, 0),
                            'simulationCount', COALESCE(simulation_count, 0),
                            'requiredSimulations', COALESCE(required_simulations, 0),
                            'status', CASE
                                WHEN total_students_seen = 0 THEN 'neutral'
                                WHEN (100.0 * passed_students / NULLIF(total_students_seen, 0)) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                                WHEN (100.0 * passed_students / NULLIF(total_students_seen, 0)) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                                ELSE 'danger'
                            END
                        ) ORDER BY cohort_name) FROM cohort_agg), '[]'::json),
                        'dailyData', COALESCE((SELECT json_agg(json_build_object(
                            'date', date,
                            'avgScore', ROUND(COALESCE(avg_score, 0))::int,
                            'cohortId', cohort_id
                        ) ORDER BY cohort_id, date) FROM cohort_daily_data), '[]'::json),
                        'cohortFacts', '[]'::json,
                        'dailyFacts', '[]'::json,
                        'validSimulationIds', COALESCE((
                            SELECT json_agg(DISTINCT simulation_id::text) FROM filt WHERE simulation_id IS NOT NULL
                        ), '[]'::json),
                        'status', CASE
                            WHEN (SELECT COUNT(*) FROM cohort_agg) = 0 THEN 'neutral'
                            WHEN (SELECT AVG(
                                CASE 
                                    WHEN total_students_seen > 0 THEN 
                                        (100.0 * passed_students / total_students_seen)::numeric
                                    ELSE 0
                                END
                            ) FROM cohort_agg) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                            WHEN (SELECT AVG(
                                CASE 
                                    WHEN total_students_seen > 0 THEN 
                                        (100.0 * passed_students / total_students_seen)::numeric
                                    ELSE 0
                                END
                            ) FROM cohort_agg) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                            ELSE 'danger'
                        END
                    ),
                    'skillPerformance', json_build_object(
                        'packages', COALESCE((
                            SELECT json_agg(json_build_object(
                                'rubricId', vr.rubric_id::text,
                                'radarData', COALESCE(rpr.radar, '[]'::json),
                                'groupFacts', COALESCE(fpr.facts, '[]'::json)
                            ) ORDER BY vr.rubric_id::text)
                            FROM skill_valid_rubrics vr
                            LEFT JOIN radar_per_rubric rpr ON rpr.rubric_id = vr.rubric_id
                            LEFT JOIN skill_facts_per_rubric fpr ON fpr.rubric_id = vr.rubric_id
                        ), '[]'::json),
                        'validRubricIds', COALESCE((
                            SELECT json_agg(rubric_id::text ORDER BY rubric_id::text) FROM skill_valid_rubrics
                        ), '[]'::json),
                        'status', CASE
                            WHEN (SELECT COUNT(*) FROM skill_valid_rubrics) = 0 THEN 'neutral'
                            WHEN (SELECT AVG((rd->>'value')::float * 100) FROM skill_valid_rubrics vr
                                  LEFT JOIN radar_per_rubric rpr ON rpr.rubric_id = vr.rubric_id,
                                  json_array_elements(COALESCE(rpr.radar, '[]'::json)) rd) IS NULL THEN 'neutral'
                            WHEN (SELECT AVG((rd->>'value')::float * 100) FROM skill_valid_rubrics vr
                                  LEFT JOIN radar_per_rubric rpr ON rpr.rubric_id = vr.rubric_id,
                                  json_array_elements(COALESCE(rpr.radar, '[]'::json)) rd) >= 
                                 (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                            WHEN (SELECT AVG((rd->>'value')::float * 100) FROM skill_valid_rubrics vr
                                  LEFT JOIN radar_per_rubric rpr ON rpr.rubric_id = vr.rubric_id,
                                  json_array_elements(COALESCE(rpr.radar, '[]'::json)) rd) >= 
                                 (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                            ELSE 'danger'
                        END
                    )
                ),
                'footer', json_build_object(
                    'scenarioPerformance', json_build_object(
                        'validParameterIds', COALESCE((
                            SELECT json_agg(parameter_id::text ORDER BY parameter_id::text)
                            FROM valid_categorical_params
                        ), '[]'::json),
                        'attributeAttemptFacts', COALESCE((
                            SELECT json_agg(
                                json_build_object(
                                    'parameterId', parameter_id::text,
                                    'parameterItemId', parameter_item_id::text,
                                    'date', date,
                                    'timestamp', ts,
                                    'avgScore', ROUND(avg_score)::int,
                                    'attempts', attempts,
                                    'passedAttempts', passed_attempts
                                )
                            ) FROM attempt_daily_categorical
                        ), '[]'::json),
                        'attributeScenarioFacts', COALESCE((
                            SELECT json_agg(
                                json_build_object(
                                    'parameterId', parameter_id::text,
                                    'parameterItemId', parameter_item_id::text,
                                    'scenarioId', scenario_id::text
                                )
                            ) FROM (SELECT DISTINCT * FROM cat_map_seen) d
                        ), '[]'::json),
                        'status', CASE
                            WHEN (SELECT COUNT(*) FROM attempt_daily_categorical) = 0 THEN 'neutral'
                            WHEN (SELECT AVG(avg_score) FROM attempt_daily_categorical) >= 
                                 (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                            WHEN (SELECT AVG(avg_score) FROM attempt_daily_categorical) >= 
                                 (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                            ELSE 'danger'
                        END
                    ),
                    'scenarioStats', json_build_object(
                        'validNumericParameterIds', COALESCE((
                            SELECT json_agg(parameter_id::text ORDER BY parameter_id::text) 
                            FROM valid_numeric_params
                        ), '[]'::json),
                        'numericAttemptFacts', COALESCE((
                            SELECT json_agg(
                                json_build_object(
                                    'parameterId', parameter_id::text,
                                    'levelLabel', level_label,
                                    'levelValue', level_value,
                                    'score', ROUND(avg_score)::int,
                                    'attempts', attempts
                                )
                            ) FROM numeric_agg
                        ), '[]'::json),
                        'numericScenarioFacts', COALESCE((
                            SELECT json_agg(
                                json_build_object(
                                    'parameterId', parameter_id::text,
                                    'scenarioId', scenario_id::text,
                                    'levelLabel', CASE 
                                        WHEN level = floor(level) THEN level::int::text 
                                        ELSE to_char(level, 'FM999D0') 
                                    END,
                                    'levelValue', CASE 
                                        WHEN level = floor(level) THEN level::numeric 
                                        ELSE round(level::numeric, 1) 
                                    END
                                )
                            ) FROM (SELECT DISTINCT * FROM num_map_seen) d
                        ), '[]'::json),
                        'status', CASE
                            WHEN (SELECT COUNT(*) FROM numeric_agg) = 0 THEN 'neutral'
                            WHEN (SELECT AVG(avg_score) FROM numeric_agg) >= 
                                 (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                            WHEN (SELECT AVG(avg_score) FROM numeric_agg) >= 
                                 (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                            ELSE 'danger'
                        END
                    ),
                    'simulationPerformance', json_build_object(
                        'validSimulationIds', COALESCE((SELECT json_agg(DISTINCT simulation_id::text) FROM sim_perf), '[]'::json),
                        'scenarioFacts', COALESCE((SELECT json_agg(json_build_object(
                            'simulationId', simulation_id::text,
                            'scenarioId', scenario_id::text,
                            'scenarioName', scenario_name,
                            'avgScore', ROUND(avg_score)::int,
                            'successRate', ROUND(success_rate)::int,
                            'totalAttempts', total_attempts,
                            'completedAttempts', completed_attempts
                        )) FROM sim_perf), '[]'::json),
                        'status', CASE
                            WHEN (SELECT COUNT(*) FROM sim_perf) = 0 THEN 'neutral'
                            WHEN (SELECT (0.7 * AVG(avg_score) + 0.3 * AVG(success_rate)) FROM sim_perf) >= 
                                 (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                            WHEN (SELECT (0.7 * AVG(avg_score) + 0.3 * AVG(success_rate)) FROM sim_perf) >= 
                                 (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                            ELSE 'danger'
                        END
                    ),
                    'simulationComposition', json_build_object(
                        'validSimulationIds', COALESCE((
                            SELECT json_agg(DISTINCT simulation_id::text ORDER BY simulation_id::text) 
                            FROM filt WHERE simulation_id IS NOT NULL
                        ), '[]'::json),
                        'simulationFacts', COALESCE((
                            SELECT json_agg(
                                json_build_object(
                            'simulationId', simulation_id::text,
                                    'title', simulation_title,
                                    'avgScore', avg_score,
                                    'passRate', pass_rate,
                                    'completionRate', completion_rate,
                                    'totalAttempts', total_attempts,
                                    'scenarioCount', scenario_count
                                ) ORDER BY simulation_title
                            ) FROM simulation_facts
                        ), '[]'::json),
                        'simulationParameterFactsCategorical', COALESCE((
                            SELECT json_agg(
                                json_build_object(
                                    'simulationId', simulation_id::text,
                                    'parameterId', parameter_id::text,
                                    'parameterItemId', parameter_item_id::text,
                                    'scenarioCount', scenario_count
                                )
                            ) FROM param_facts_cat
                        ), '[]'::json),
                        'simulationParameterFactsNumeric', COALESCE((
                            SELECT json_agg(
                                json_build_object(
                                    'simulationId', simulation_id::text,
                                    'parameterId', parameter_id::text,
                                    'avgLevel', avg_level,
                                    'levelLabel', level_label,
                                    'scenarioCount', scenario_count
                                )
                            ) FROM param_facts_num
                        ), '[]'::json),
                        'hasData', EXISTS (SELECT 1 FROM sim_summary),
                        'status', CASE
                            WHEN (SELECT COUNT(*) FROM simulation_facts) = 0 THEN 'neutral'
                            WHEN (SELECT AVG(avg_score) FROM simulation_facts) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) 
                                 AND (SELECT AVG(completion_rate) FROM simulation_facts) >= 80 THEN 'success'
                            WHEN (SELECT AVG(avg_score) FROM simulation_facts) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) 
                                 OR (SELECT AVG(completion_rate) FROM simulation_facts) >= 70 THEN 'warning'
                            ELSE 'danger'
                        END
                    )
                ),
                'simulationMapping', COALESCE((SELECT mapping FROM simulation_mapping LIMIT 1), '{}'::jsonb),
                'rubricMapping', COALESCE((SELECT mapping FROM rubric_mapping LIMIT 1), '{}'::jsonb),
                'parameterMapping', COALESCE((SELECT mapping FROM parameter_mapping LIMIT 1), '{}'::jsonb),
                'fieldMapping', COALESCE((SELECT mapping FROM field_mapping LIMIT 1), '{}'::jsonb),
                'thresholds', COALESCE((
                    SELECT json_build_object(
                        'success', success_threshold,
                        'warning', warning_threshold,
                        'danger', danger_threshold
                    ) FROM settings_thresholds LIMIT 1
                ), json_build_object('success', 85, 'warning', 80, 'danger', 70))
            ) AS result
        