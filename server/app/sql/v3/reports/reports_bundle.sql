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
            -- Start from profiles to include all matching profiles, even without attempts
            filtered_profiles AS (
                SELECT 
                    p.id, 
                    p.first_name, 
                    p.last_name, 
                    ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
                    (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
                    p.role
                FROM profiles p
                LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
                WHERE TRUE
                GROUP BY p.id, p.first_name, p.last_name, p.role
            ),
            filt AS (
                SELECT a.* FROM analytics a
                WHERE TRUE
                  AND a.profile_id IN (SELECT id FROM filtered_profiles)
            ),
            profile_metrics AS (
                SELECT
                    fp.id AS profile_id,
                    fp.first_name,
                    fp.last_name,
                    fp.emails,
                    fp.primary_email,
                    fp.role,
                    AVG(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS avg_score,
                    MAX(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS highest_score,
                    COUNT(DISTINCT f.attempt_id)::int AS total_attempts,
                    AVG(f.num_messages_total) FILTER (WHERE f.num_messages_total IS NOT NULL) AS avg_messages,
                    AVG(f.time_taken_seconds / 60.0) FILTER (WHERE f.time_taken_seconds IS NOT NULL) AS avg_time_minutes
                FROM filtered_profiles fp
                LEFT JOIN filt f ON f.profile_id = fp.id
                GROUP BY fp.id, fp.first_name, fp.last_name, fp.emails, fp.primary_email, fp.role
            ),
            -- Total time spent per profile (SUM with 30-minute cap per chat, matching dashboard)
            total_time_per_profile AS (
                SELECT
                    f.profile_id,
                    SUM(LEAST(f.time_taken_seconds / 60.0, 30.0))::float AS total_time_minutes
                FROM filt f
                WHERE f.time_taken_seconds IS NOT NULL
                GROUP BY f.profile_id
            ),
            -- Completion percentage per profile (chat-level aggregation to match dashboard)
            completion_per_profile AS (
                SELECT
                    fp.id AS profile_id,
                    (100.0 * AVG((f.completed)::int))::float AS completion_pct
                FROM filtered_profiles fp
                LEFT JOIN filt f ON f.profile_id = fp.id
                GROUP BY fp.id
                HAVING COUNT(f.attempt_id) > 0
            ),
            -- First attempt pass rate per profile (all-time earliest attempts, then filter to window)
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
            -- Session efficiency per profile (new formula: avgScore * (1 - min(1, avgMinutes/120)))
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
            -- Stagnation rate per profile (grade-stream approach using grades)
            profile_chats AS (
                SELECT DISTINCT profile_id, chat_id 
                FROM filt 
                WHERE chat_id IS NOT NULL
            ),
            grade_stream_per_profile AS (
                SELECT
                    pc.profile_id,
                    sg.id,
                    c_bundle.id AS simulation_chat_id,
                    sg.created_at,
                    (sg.score::numeric / NULLIF(r.points, 0)) * 100.0 AS norm
                FROM grades sg
                JOIN runs r_bundle ON r_bundle.id = sg.run_id
                JOIN group_runs gr_bundle ON gr_bundle.run_id = r_bundle.id
                JOIN groups g_bundle ON g_bundle.id = gr_bundle.group_id
                JOIN chat_groups cg_bundle ON cg_bundle.group_id = g_bundle.id
                JOIN chats c_bundle ON c_bundle.id = cg_bundle.chat_id
                JOIN profile_chats pc ON pc.chat_id = c_bundle.id
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
            -- Build data points arrays per profile for each metric
            avg_score_data_points AS (
                SELECT
                    f.profile_id,
                    json_agg(json_build_object(
                        'profileId', f.profile_id::text,
                        'date', to_char(f.attempt_created_at, 'YYYY-MM-DD'),
                        'value', f.grade_percent,
                        'simulationId', f.simulation_id::text,
                        'scenarioId', f.scenario_id::text
                    ) ORDER BY f.attempt_created_at) AS data_points
                FROM filt f
                WHERE f.grade_percent IS NOT NULL
                GROUP BY f.profile_id
            ),
            completion_data_points AS (
                SELECT
                    f.profile_id,
                    json_agg(json_build_object(
                        'profileId', f.profile_id::text,
                        'date', to_char(f.chat_created_at, 'YYYY-MM-DD'),
                        'value', (f.completed)::int,
                        'simulationId', f.simulation_id::text,
                        'scenarioId', f.scenario_id::text
                    ) ORDER BY f.chat_created_at) AS data_points
                FROM filt f
                GROUP BY f.profile_id
            ),
            first_attempt_data_points AS (
                SELECT
                    fa.profile_id,
                    json_agg(json_build_object(
                        'profileId', fa.profile_id::text,
                        'date', to_char(ea.attempt_created_at, 'YYYY-MM-DD'),
                        'value', (fa.passed)::int,
                        'simulationId', ea.simulation_id::text
                    ) ORDER BY ea.attempt_created_at) AS data_points
                FROM first_attempts fa
                JOIN earliest_attempts_all_time ea ON ea.profile_id = fa.profile_id
                GROUP BY fa.profile_id
            ),
            highest_score_data_points AS (
                SELECT
                    f.profile_id,
                    json_agg(json_build_object(
                        'profileId', f.profile_id::text,
                        'date', to_char(f.attempt_created_at, 'YYYY-MM-DD'),
                        'value', f.grade_percent,
                        'simulationId', f.simulation_id::text,
                        'scenarioId', f.scenario_id::text
                    ) ORDER BY f.attempt_created_at) AS data_points
                FROM filt f
                WHERE f.grade_percent IS NOT NULL
                GROUP BY f.profile_id
            ),
            messages_data_points AS (
                SELECT
                    f.profile_id,
                    json_agg(json_build_object(
                        'profileId', f.profile_id::text,
                        'date', to_char(f.attempt_created_at, 'YYYY-MM-DD'),
                        'value', f.num_messages_total,
                        'simulationId', f.simulation_id::text,
                        'scenarioId', f.scenario_id::text
                    ) ORDER BY f.attempt_created_at) AS data_points
                FROM filt f
                WHERE f.num_messages_total IS NOT NULL
                GROUP BY f.profile_id
            ),
            persona_time_data_points AS (
                SELECT
                    pt.profile_id,
                    json_agg(json_build_object(
                        'profileId', pt.profile_id::text,
                        'value', pt.delta_sec
                    )) AS data_points
                FROM persona_times pt
                GROUP BY pt.profile_id
            ),
            time_spent_data_points AS (
                SELECT
                    f.profile_id,
                    json_agg(json_build_object(
                        'profileId', f.profile_id::text,
                        'date', to_char(f.chat_created_at, 'YYYY-MM-DD'),
                        'value', LEAST(f.time_taken_seconds / 60.0, 30.0),
                        'attemptId', f.attempt_id::text,
                        'simulationId', f.simulation_id::text,
                        'scenarioId', f.scenario_id::text
                    ) ORDER BY f.chat_created_at) AS data_points
                FROM filt f
                WHERE f.time_taken_seconds IS NOT NULL
                GROUP BY f.profile_id
            ),
            total_attempts_data_points AS (
                SELECT
                    profile_id,
                    json_agg(json_build_object(
                        'profileId', profile_id::text,
                        'attemptId', attempt_id::text,
                        'simulationId', simulation_id::text
                    )) AS data_points
                FROM (
                    SELECT DISTINCT profile_id, attempt_id, simulation_id
                    FROM filt
                ) sub
                GROUP BY profile_id
            ),
            efficiency_data_points AS (
                SELECT
                    profile_id,
                    json_agg(json_build_object(
                        'profileId', profile_id::text,
                        'value', ROUND(GREATEST(0, LEAST(100, 
                            avg_score * (1.0 - LEAST(1.0, (total_minutes / NULLIF(total_sessions, 0)) / 120.0))
                        )))::int
                    )) AS data_points
                FROM efficiency_metrics_per_profile
                GROUP BY profile_id
            ),
            stagnation_data_points AS (
                SELECT
                    sf.profile_id,
                    json_agg(json_build_object(
                        'profileId', sf.profile_id::text,
                        'value', sf.stagnated
                    )) AS data_points
                FROM stagnation_flags_per_profile sf
                GROUP BY sf.profile_id
            ),
            -- Extract unique simulation_ids and scenario_ids per profile for filtering
            profile_simulation_ids AS (
                SELECT
                    f.profile_id,
                    ARRAY_AGG(DISTINCT f.simulation_id::text) FILTER (WHERE f.simulation_id IS NOT NULL) AS simulation_ids
                FROM filt f
                GROUP BY f.profile_id
            ),
            -- Recursively map child scenarios to root parent scenarios
            scenario_root_mapping AS (
                WITH RECURSIVE scenario_ancestors AS (
                    -- Base case: start with all unique scenario IDs from filt
                    SELECT DISTINCT
                        f.scenario_id as child_scenario_id,
                        f.scenario_id as ancestor_id,
                        0 as depth
                    FROM filt f
                    WHERE f.scenario_id IS NOT NULL
                    
                    UNION ALL
                    
                    -- Recursive case: traverse up the tree
                    SELECT 
                        sa.child_scenario_id,
                        COALESCE(
                            (SELECT st.parent_id 
                             FROM scenario_tree st 
                             WHERE st.child_id = sa.ancestor_id 
                               AND st.parent_id != st.child_id 
                             LIMIT 1),
                            sa.ancestor_id
                        ) as ancestor_id,
                        sa.depth + 1 as depth
                    FROM scenario_ancestors sa
                    WHERE sa.depth < 100  -- Safety limit
                      AND EXISTS (
                          SELECT 1 FROM scenario_tree st 
                          WHERE st.child_id = sa.ancestor_id 
                            AND st.parent_id != st.child_id
                      )
                )
                SELECT DISTINCT
                    child_scenario_id,
                    ancestor_id as root_scenario_id
                FROM scenario_ancestors
                WHERE depth = (
                    SELECT MAX(depth) 
                    FROM scenario_ancestors sa2 
                    WHERE sa2.child_scenario_id = scenario_ancestors.child_scenario_id
                )
            ),
            profile_scenario_ids AS (
                SELECT
                    f.profile_id,
                    ARRAY_AGG(DISTINCT COALESCE(
                        (SELECT srm.root_scenario_id::text 
                         FROM scenario_root_mapping srm 
                         WHERE srm.child_scenario_id = f.scenario_id),
                        f.scenario_id::text
                    )) FILTER (WHERE f.scenario_id IS NOT NULL) AS scenario_ids
                FROM filt f
                GROUP BY f.profile_id
            ),
            -- Join all metrics together - start from profile_metrics to include all profiles
            all_metrics AS (
                SELECT
                    pm.*,
                    COALESCE(tt.total_time_minutes, 0) AS total_time_minutes,
                    COALESCE(cp.completion_pct, 0) AS completion_pct,
                    COALESCE(fa.pass_rate, 0) AS first_attempt_pass_rate,
                    COALESCE(pp.avg_response_time, 0) AS persona_response_time,
                    COALESCE(ep.efficiency, 0) AS session_efficiency,
                    COALESCE(sp.stagnation_rate, 0) AS stagnation_rate,
                    COALESCE(asdp.data_points, '[]'::json) AS avg_score_points,
                    COALESCE(cdp.data_points, '[]'::json) AS completion_points,
                    COALESCE(fadp.data_points, '[]'::json) AS first_attempt_points,
                    COALESCE(hsdp.data_points, '[]'::json) AS highest_score_points,
                    COALESCE(mdp.data_points, '[]'::json) AS messages_points,
                    COALESCE(ptdp.data_points, '[]'::json) AS persona_time_points,
                    COALESCE(tsdp.data_points, '[]'::json) AS time_spent_points,
                    COALESCE(tadp.data_points, '[]'::json) AS total_attempts_points,
                    COALESCE(edp.data_points, '[]'::json) AS efficiency_points,
                    COALESCE(sdp.data_points, '[]'::json) AS stagnation_points,
                    COALESCE(psi.simulation_ids, ARRAY[]::text[]) AS simulation_ids,
                    COALESCE(psc.scenario_ids, ARRAY[]::text[]) AS scenario_ids
                FROM profile_metrics pm
                LEFT JOIN total_time_per_profile tt ON pm.profile_id = tt.profile_id
                LEFT JOIN completion_per_profile cp ON pm.profile_id = cp.profile_id
                LEFT JOIN first_attempt_per_profile fa ON pm.profile_id = fa.profile_id
                LEFT JOIN persona_per_profile pp ON pm.profile_id = pp.profile_id
                LEFT JOIN efficiency_per_profile ep ON pm.profile_id = ep.profile_id
                LEFT JOIN stagnation_per_profile sp ON pm.profile_id = sp.profile_id
                LEFT JOIN avg_score_data_points asdp ON pm.profile_id = asdp.profile_id
                LEFT JOIN completion_data_points cdp ON pm.profile_id = cdp.profile_id
                LEFT JOIN first_attempt_data_points fadp ON pm.profile_id = fadp.profile_id
                LEFT JOIN highest_score_data_points hsdp ON pm.profile_id = hsdp.profile_id
                LEFT JOIN messages_data_points mdp ON pm.profile_id = mdp.profile_id
                LEFT JOIN persona_time_data_points ptdp ON pm.profile_id = ptdp.profile_id
                LEFT JOIN time_spent_data_points tsdp ON pm.profile_id = tsdp.profile_id
                LEFT JOIN total_attempts_data_points tadp ON pm.profile_id = tadp.profile_id
                LEFT JOIN efficiency_data_points edp ON pm.profile_id = edp.profile_id
                LEFT JOIN stagnation_data_points sdp ON pm.profile_id = sdp.profile_id
                LEFT JOIN profile_simulation_ids psi ON pm.profile_id = psi.profile_id
                LEFT JOIN profile_scenario_ids psc ON pm.profile_id = psc.profile_id
            ),
            -- Get all unique profile options from all_metrics (before pagination)
            profile_options_cte AS (
                SELECT 
                    am.profile_id,
                    am.first_name || ' ' || am.last_name AS profile_name,
                    COUNT(*) AS count
                FROM all_metrics am
                GROUP BY am.profile_id, am.first_name, am.last_name
                ORDER BY profile_name
            ),
            -- Get all unique simulation options from all_metrics (before pagination)
            simulation_options_cte AS (
                SELECT 
                    sim.id AS simulation_id,
                    sim.title AS simulation_name,
                    COUNT(DISTINCT am.profile_id) AS count
                FROM all_metrics am
                CROSS JOIN LATERAL UNNEST(am.simulation_ids) AS sim_id
                JOIN simulations sim ON sim.id::text = sim_id
                WHERE sim.active = true
                GROUP BY sim.id, sim.title
                ORDER BY simulation_name
            ),
            -- Get all unique scenario options from all_metrics (before pagination)
            scenario_options_cte AS (
                SELECT 
                    s.id AS scenario_id,
                    s.name AS scenario_title,
                    COUNT(DISTINCT am.profile_id) AS count
                FROM all_metrics am
                CROSS JOIN LATERAL UNNEST(am.scenario_ids) AS scen_id
                JOIN scenarios s ON s.id::text = scen_id
                WHERE s.active = true
                GROUP BY s.id, s.name
                ORDER BY scenario_title
            ),
            -- Add pagination and sorting to all_metrics
            -- Note: ORDER BY and LIMIT/OFFSET are replaced dynamically by route
            -- Defaults ensure SQL compiles; route replaces with actual values
            paginated_metrics AS (
                SELECT
                    *,
                    COUNT(*) OVER() AS total_count
                FROM all_metrics
                ORDER BY created_at DESC NULLS LAST
                LIMIT 100 OFFSET 0
            ),
            -- Use paginated_metrics directly (emails already included from profile_metrics)
            paginated_metrics_with_emails AS (
                SELECT pm.*
                FROM paginated_metrics pm
            )
            SELECT json_build_object(
                'data', COALESCE((                SELECT json_agg(json_build_object(
                    'profileId', profile_id::text,
                    'firstName', first_name,
                    'lastName', last_name,
                    'emails', COALESCE(emails, ARRAY[]::text[]),
                    'primaryEmail', primary_email,
                    'role', role,
                    'simulationIds', simulation_ids,
                    'scenarioIds', scenario_ids,
                    'metrics', json_build_object(
                        'averageScore', json_build_object(
                            'hasData', avg_score IS NOT NULL AND avg_score > 0,
                            'method', 'avg',
                            'currentValue', ROUND(COALESCE(avg_score, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', avg_score_points,
                            'hover', json_build_object(
                                'mean', ROUND(COALESCE(avg_score, 0))::int,
                                'median', ROUND(COALESCE(avg_score, 0))::int,
                                'mode', ROUND(COALESCE(avg_score, 0))::int
                            ),
                            'status', CASE
                                WHEN avg_score IS NULL OR avg_score = 0 THEN 'neutral'
                                WHEN ROUND(avg_score) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                                WHEN ROUND(avg_score) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                                ELSE 'danger'
                            END
                        ),
                        'completionPercentage', json_build_object(
                            'hasData', completion_pct IS NOT NULL AND completion_pct > 0,
                            'method', 'rate',
                            'currentValue', ROUND(COALESCE(completion_pct, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', completion_points,
                            'hover', COALESCE(json_build_object(
                                'completed', 0,
                                'total', 0,
                                'percent', ROUND(COALESCE(completion_pct, 0))::int
                            ), json_build_object('completed', 0, 'total', 0, 'percent', 0)),
                            'status', CASE
                                WHEN completion_pct IS NULL OR completion_pct = 0 THEN 'neutral'
                                WHEN ROUND(completion_pct) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                                WHEN ROUND(completion_pct) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                                ELSE 'danger'
                            END
                        ),
                        'firstAttemptPassRate', json_build_object(
                            'hasData', first_attempt_pass_rate IS NOT NULL AND first_attempt_pass_rate > 0,
                            'method', 'rate',
                            'currentValue', ROUND(COALESCE(first_attempt_pass_rate, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', first_attempt_points,
                            'hover', COALESCE(json_build_object(
                                'passed', 0,
                                'total', 0,
                                'percent', ROUND(COALESCE(first_attempt_pass_rate, 0))::int
                            ), json_build_object('passed', 0, 'total', 0, 'percent', 0)),
                            'status', CASE
                                WHEN first_attempt_pass_rate IS NULL OR first_attempt_pass_rate = 0 THEN 'neutral'
                                WHEN ROUND(first_attempt_pass_rate) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                                WHEN ROUND(first_attempt_pass_rate) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                                ELSE 'danger'
                            END
                        ),
                        'highestScore', json_build_object(
                            'hasData', highest_score IS NOT NULL AND highest_score > 0,
                            'method', 'max',
                            'currentValue', ROUND(COALESCE(highest_score, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', highest_score_points,
                            'hover', COALESCE(json_build_object(
                                'top', ARRAY[ROUND(COALESCE(highest_score, 0))::int]
                            ), json_build_object('top', ARRAY[0])),
                            'status', CASE
                                WHEN highest_score IS NULL OR highest_score = 0 THEN 'neutral'
                                WHEN ROUND(highest_score) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                                WHEN ROUND(highest_score) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                                ELSE 'danger'
                            END
                        ),
                        'messagesPerSession', json_build_object(
                            'hasData', avg_messages IS NOT NULL AND avg_messages > 0,
                            'method', 'avg',
                            'currentValue', ROUND(COALESCE(avg_messages, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', messages_points,
                            'hover', CASE 
                                WHEN avg_messages IS NOT NULL THEN json_build_object(
                                    'mean', ROUND(avg_messages)::int,
                                    'median', ROUND(avg_messages)::int,
                                    'count', total_attempts
                                )
                                ELSE json_build_object(
                                    'mean', 0,
                                    'median', 0,
                                    'count', 0
                                )
                            END,
                            'status', CASE
                                WHEN avg_messages IS NULL OR avg_messages = 0 THEN 'neutral'
                                WHEN ROUND(avg_messages) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                                WHEN ROUND(avg_messages) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                                ELSE 'danger'
                            END
                        ),
                        'personaResponseTimes', json_build_object(
                            'hasData', persona_response_time IS NOT NULL AND persona_response_time > 0,
                            'method', 'avg',
                            'currentValue', ROUND(COALESCE(persona_response_time, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', persona_time_points,
                            'hover', CASE 
                                WHEN persona_response_time IS NOT NULL AND persona_response_time > 0 THEN json_build_object(
                                    'meanSeconds', ROUND(persona_response_time)::int,
                                    'medianSeconds', ROUND(persona_response_time)::int,
                                    'samples', 0
                                )
                                ELSE json_build_object(
                                    'meanSeconds', 0,
                                    'medianSeconds', 0,
                                    'samples', 0
                                )
                            END,
                            'status', CASE
                                WHEN persona_response_time IS NULL OR persona_response_time = 0 THEN 'neutral'
                                WHEN ROUND(persona_response_time) > (SELECT danger_threshold FROM settings_thresholds LIMIT 1) THEN 'danger'
                                WHEN ROUND(persona_response_time) > (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                                ELSE 'success'
                            END
                        ),
                        'sessionEfficiency', json_build_object(
                            'hasData', session_efficiency > 0,
                            'method', 'avg',
                            'currentValue', ROUND(COALESCE(session_efficiency, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', efficiency_points,
                            'hover', json_build_object(
                                'avgScorePercent', 0,
                                'avgMinutes', 0,
                                'efficiency', ROUND(COALESCE(session_efficiency, 0))::int
                            ),
                            'status', CASE
                                WHEN session_efficiency IS NULL OR session_efficiency = 0 THEN 'neutral'
                                WHEN ROUND(session_efficiency) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                                WHEN ROUND(session_efficiency) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                                ELSE 'danger'
                            END
                        ),
                        'stagnationRate', json_build_object(
                            'hasData', stagnation_rate > 0,
                            'method', 'rate',
                            'currentValue', ROUND(COALESCE(stagnation_rate, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', stagnation_points,
                            'hover', json_build_object(
                                'tracked', 0,
                                'stagnant', 0,
                                'ratePercent', ROUND(COALESCE(stagnation_rate, 0))::int
                            ),
                            'status', CASE
                                WHEN stagnation_rate IS NULL OR stagnation_rate = 0 THEN 'neutral'
                                WHEN ROUND(stagnation_rate) > (SELECT danger_threshold FROM settings_thresholds LIMIT 1) THEN 'danger'
                                WHEN ROUND(stagnation_rate) > (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                                ELSE 'success'
                            END
                        ),
                        'timeSpent', json_build_object(
                            'hasData', total_time_minutes IS NOT NULL AND total_time_minutes > 0,
                            'method', 'sum',
                            'currentValue', ROUND(COALESCE(total_time_minutes, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', time_spent_points,
                            'hover', json_build_object(
                                'totalMinutes', ROUND(COALESCE(total_time_minutes, 0))::int,
                                'totalHours', ROUND(COALESCE(total_time_minutes, 0)::numeric / 60.0, 1)
                            ),
                            'status', CASE
                                WHEN total_time_minutes IS NULL OR total_time_minutes = 0 THEN 'neutral'
                                WHEN ROUND(total_time_minutes) >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                                WHEN ROUND(total_time_minutes) >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                                ELSE 'danger'
                            END
                        ),
                        'totalAttempts', json_build_object(
                            'hasData', true,
                            'method', 'countDistinct',
                            'currentValue', COALESCE(total_attempts, 0),
                            'trendData', '[]'::json,
                            'dataPoints', total_attempts_points,
                            'hover', json_build_object(
                                'attempts', COALESCE(total_attempts, 0),
                                'uniqueSimulations', 0,
                                'perSimulationMean', 0
                            ),
                            'status', CASE
                                WHEN total_attempts IS NULL OR total_attempts = 0 THEN 'neutral'
                                WHEN total_attempts >= (SELECT success_threshold FROM settings_thresholds LIMIT 1) THEN 'success'
                                WHEN total_attempts >= (SELECT warning_threshold FROM settings_thresholds LIMIT 1) THEN 'warning'
                                ELSE 'danger'
                            END
                        )
                    )
                ) ORDER BY created_at DESC) FROM paginated_metrics_with_emails), '[]'::json),
                'totalCount', COALESCE((SELECT total_count FROM (SELECT * FROM paginated_metrics LIMIT 1) pm_count), 0),
                'profileOptions', COALESCE((
                    SELECT json_agg(json_build_object(
                        'value', poc.profile_id::text,
                        'label', poc.profile_name,
                        'count', poc.count
                    ))
                    FROM profile_options_cte poc
                ), '[]'::json),
                'simulationOptions', COALESCE((
                    SELECT json_agg(json_build_object(
                        'value', soc.simulation_id::text,
                        'label', soc.simulation_name,
                        'count', soc.count
                    ))
                    FROM simulation_options_cte soc
                ), '[]'::json),
                'scenarioOptions', COALESCE((
                    SELECT json_agg(json_build_object(
                        'value', scoc.scenario_id::text,
                        'label', scoc.scenario_title,
                        'count', scoc.count
                    ))
                    FROM scenario_options_cte scoc
                ), '[]'::json),
                'scenario_mapping', COALESCE((
                    SELECT jsonb_object_agg(
                        s.id::text,
                        jsonb_build_object(
                            'name', s.name,
                            'description', COALESCE(
                                (SELECT ps.problem_statement 
                                 FROM scenario_problem_statements sps
                                 JOIN problem_statements ps ON ps.id = sps.problem_statement_id
                                 WHERE sps.scenario_id = s.id AND sps.active = true
                                 ORDER BY sps.created_at DESC, sps.updated_at DESC
                                 LIMIT 1), 
                                ''
                            )
                        )
                    )
                    FROM scenarios s
                    -- Only include parent scenarios (where parent_id = child_id in scenario_tree)
                    JOIN scenario_tree st_root ON st_root.parent_id = s.id AND st_root.child_id = s.id
                    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
                    WHERE s.active = true
                      -- Only include parent scenarios that have child scenarios appearing in the filtered data
                      AND EXISTS (
                          SELECT 1 FROM filt f
                          WHERE f.scenario_id IS NOT NULL
                            AND (
                                -- Child scenario maps to this parent scenario
                                EXISTS (
                                    SELECT 1 FROM scenario_tree st
                                    WHERE st.child_id = f.scenario_id
                                      AND st.parent_id = s.id
                                )
                                -- OR child scenario IS the parent scenario (no child variant)
                                OR f.scenario_id = s.id
                            )
                      )
                      -- Department filtering removed - departments are already filtered at profile level
                ), '{}'::jsonb),
                'simulation_mapping', COALESCE((
                    SELECT jsonb_object_agg(
                        sim.id::text,
                        jsonb_build_object(
                            'name', sim.title,
                            'description', COALESCE(sim.description, ''),
                            'rubric_id', (SELECT ss.rubric_id FROM simulation_scenarios ss WHERE ss.simulation_id = sim.id AND ss.active = true ORDER BY ss.position LIMIT 1)::text,
                            'rubric_points', (SELECT r.points FROM rubrics r WHERE r.id = (SELECT ss.rubric_id FROM simulation_scenarios ss WHERE ss.simulation_id = sim.id AND ss.active = true ORDER BY ss.position LIMIT 1)),
                            'rubric_pass_points', (SELECT r.pass_points FROM rubrics r WHERE r.id = (SELECT ss.rubric_id FROM simulation_scenarios ss WHERE ss.simulation_id = sim.id AND ss.active = true ORDER BY ss.position LIMIT 1))
                        )
                    )
                    FROM simulations sim
                    WHERE sim.active = true
                      -- Only include simulations that appear in the filtered data (respects simulationFilters)
                      AND sim.id IN (SELECT DISTINCT simulation_id FROM filt WHERE simulation_id IS NOT NULL)
                ), '{}'::jsonb)
            ) AS result
