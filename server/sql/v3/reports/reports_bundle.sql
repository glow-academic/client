
            WITH filt AS (
                SELECT * FROM analytics a WHERE {WHERE_CLAUSE}
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
            -- Completion percentage per profile (chat-level aggregation to match dashboard)
            completion_per_profile AS (
                SELECT
                    f.profile_id,
                    (100.0 * AVG((f.completed)::int))::float AS completion_pct
                FROM filt f
                GROUP BY f.profile_id
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
                WHERE a.profile_id IN (SELECT DISTINCT profile_id FROM filt)
                ORDER BY a.profile_id, a.simulation_id, a.attempt_created_at
            ),
            first_attempts AS (
                SELECT
                    ea.profile_id,
                    ea.grade_percent >= (ea.rubric_pass_points * 100.0 / NULLIF(ea.rubric_points, 0)) AS passed
                FROM earliest_attempts_all_time ea
                JOIN filt f ON f.profile_id = ea.profile_id
                WHERE ea.attempt_created_at >= (SELECT MIN(attempt_created_at) FROM filt)
                  AND ea.attempt_created_at <= (SELECT MAX(attempt_created_at) FROM filt)
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
            -- Stagnation rate per profile (grade-stream approach using simulation_chat_grades)
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
            -- Join all metrics together
            all_metrics AS (
                SELECT
                    pm.*,
                    COALESCE(cp.completion_pct, 0) AS completion_pct,
                    COALESCE(fa.pass_rate, 0) AS first_attempt_pass_rate,
                    COALESCE(pp.avg_response_time, 0) AS persona_response_time,
                    COALESCE(ep.efficiency, 0) AS session_efficiency,
                    COALESCE(sp.stagnation_rate, 0) AS stagnation_rate,
                    asdp.data_points AS avg_score_points,
                    cdp.data_points AS completion_points,
                    fadp.data_points AS first_attempt_points,
                    hsdp.data_points AS highest_score_points,
                    mdp.data_points AS messages_points,
                    ptdp.data_points AS persona_time_points,
                    tsdp.data_points AS time_spent_points,
                    tadp.data_points AS total_attempts_points,
                    edp.data_points AS efficiency_points,
                    sdp.data_points AS stagnation_points
                FROM profile_metrics pm
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
                            'hasData', avg_score IS NOT NULL,
                            'method', 'avg',
                            'currentValue', ROUND(COALESCE(avg_score, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', COALESCE(avg_score_points, '[]'::json),
                            'hover', json_build_object(
                                'mean', ROUND(COALESCE(avg_score, 0))::int,
                                'median', ROUND(COALESCE(avg_score, 0))::int,
                                'mode', ROUND(COALESCE(avg_score, 0))::int
                            )
                        ),
                        'completionPercentage', json_build_object(
                            'hasData', completion_pct IS NOT NULL AND completion_pct > 0,
                            'method', 'rate',
                            'currentValue', ROUND(COALESCE(completion_pct, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', COALESCE(completion_points, '[]'::json),
                            'hover', COALESCE(json_build_object(
                                'completed', 0,
                                'total', 0,
                                'percent', ROUND(COALESCE(completion_pct, 0))::int
                            ), json_build_object('completed', 0, 'total', 0, 'percent', 0))
                        ),
                        'firstAttemptPassRate', json_build_object(
                            'hasData', first_attempt_pass_rate IS NOT NULL AND first_attempt_pass_rate > 0,
                            'method', 'rate',
                            'currentValue', ROUND(COALESCE(first_attempt_pass_rate, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', COALESCE(first_attempt_points, '[]'::json),
                            'hover', COALESCE(json_build_object(
                                'passed', 0,
                                'total', 0,
                                'percent', ROUND(COALESCE(first_attempt_pass_rate, 0))::int
                            ), json_build_object('passed', 0, 'total', 0, 'percent', 0))
                        ),
                        'highestScore', json_build_object(
                            'hasData', highest_score IS NOT NULL AND highest_score > 0,
                            'method', 'max',
                            'currentValue', ROUND(COALESCE(highest_score, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', COALESCE(highest_score_points, '[]'::json),
                            'hover', COALESCE(json_build_object(
                                'top', ARRAY[ROUND(COALESCE(highest_score, 0))::int]
                            ), json_build_object('top', ARRAY[0]))
                        ),
                        'messagesPerSession', json_build_object(
                            'hasData', avg_messages IS NOT NULL AND avg_messages > 0,
                            'method', 'avg',
                            'currentValue', ROUND(COALESCE(avg_messages, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', COALESCE(messages_points, '[]'::json),
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
                            END
                        ),
                        'personaResponseTimes', json_build_object(
                            'hasData', persona_response_time IS NOT NULL AND persona_response_time > 0,
                            'method', 'avg',
                            'currentValue', ROUND(COALESCE(persona_response_time, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', COALESCE(persona_time_points, '[]'::json),
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
                            END
                        ),
                        'sessionEfficiency', json_build_object(
                            'hasData', session_efficiency > 0,
                            'method', 'avg',
                            'currentValue', ROUND(COALESCE(session_efficiency, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', COALESCE(efficiency_points, '[]'::json),
                            'hover', json_build_object(
                                'avgScorePercent', 0,
                                'avgMinutes', 0,
                                'efficiency', ROUND(COALESCE(session_efficiency, 0))::int
                            )
                        ),
                        'stagnationRate', json_build_object(
                            'hasData', stagnation_rate > 0,
                            'method', 'rate',
                            'currentValue', ROUND(COALESCE(stagnation_rate, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', COALESCE(stagnation_points, '[]'::json),
                            'hover', json_build_object(
                                'tracked', 0,
                                'stagnant', 0,
                                'ratePercent', ROUND(COALESCE(stagnation_rate, 0))::int
                            )
                        ),
                        'timeSpent', json_build_object(
                            'hasData', avg_time_minutes IS NOT NULL,
                            'method', 'avg',
                            'currentValue', ROUND(COALESCE(avg_time_minutes, 0))::int,
                            'trendData', '[]'::json,
                            'dataPoints', COALESCE(time_spent_points, '[]'::json),
                            'hover', json_build_object(
                                'avgSessionMinutes', ROUND(COALESCE(avg_time_minutes, 0))::int,
                                'avgChatMinutes', ROUND(COALESCE(avg_time_minutes, 0))::int,
                                'avgOverallMinutes', ROUND(COALESCE(avg_time_minutes, 0))::int
                            )
                        ),
                        'totalAttempts', json_build_object(
                            'hasData', true,
                            'method', 'countDistinct',
                            'currentValue', total_attempts,
                            'trendData', '[]'::json,
                            'dataPoints', COALESCE(total_attempts_points, '[]'::json),
                            'hover', json_build_object(
                                'attempts', total_attempts,
                                'uniqueSimulations', 0,
                                'perSimulationMean', 0
                            )
                        )
                    )
                )) FROM all_metrics), '[]'::json),
                'scenario_mapping', COALESCE((
                    SELECT jsonb_object_agg(
                        s.id::text,
                        jsonb_build_object(
                            'name', s.name,
                            'description', COALESCE(sps.problem_statement, '')
                        )
                    )
                    FROM scenarios s
                    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
                    LEFT JOIN scenario_departments sd ON sd.scenario_id = s.id AND sd.active = true
                    WHERE s.active = true
                      AND (
                          sd.department_id IN (SELECT DISTINCT department_id FROM filt WHERE department_id IS NOT NULL)
                          OR NOT EXISTS (SELECT 1 FROM scenario_departments sd2 WHERE sd2.scenario_id = s.id AND sd2.active = true)
                      )
                ), '{}'::jsonb),
                'simulation_mapping', COALESCE((
                    SELECT jsonb_object_agg(
                        sim.id::text,
                        jsonb_build_object(
                            'name', sim.title,
                            'description', COALESCE(sim.description, '')
                        )
                    )
                    FROM simulations sim
                    LEFT JOIN simulation_departments sd ON sd.simulation_id = sim.id AND sd.active = true
                    WHERE sim.active = true
                      AND sim.practice_simulation = true
                      AND (
                          sd.department_id IN (SELECT DISTINCT department_id FROM filt WHERE department_id IS NOT NULL)
                          OR NOT EXISTS (SELECT 1 FROM simulation_departments sd2 WHERE sd2.simulation_id = sim.id AND sd2.active = true)
                      )
                ), '{}'::jsonb)
            ) AS result
        