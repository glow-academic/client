-- Get cohort pass/fail matrix across simulations
-- Params: $1 = cohort_id
WITH cohort_members AS (
    SELECT 
        p.id,
        p.first_name,
        p.last_name,
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email
    FROM profiles p
    JOIN cohort_profiles cp ON p.id = cp.profile_id
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    WHERE cp.cohort_id = $1 AND cp.active = true
    GROUP BY p.id, p.first_name, p.last_name
),
cohort_sims AS (
    SELECT 
        s.id,
        s.title,
        s.active,
        COALESCE(
            (SELECT SUM(stl.time_limit_seconds)
             FROM scenario_time_limits stl
             JOIN simulation_scenarios ss ON ss.simulation_id = stl.simulation_id AND ss.scenario_id = stl.scenario_id
             WHERE stl.simulation_id = s.id AND stl.active = true AND ss.active = true),
            0
        ) as time_limit
    FROM simulations s
    JOIN cohort_simulations cs ON s.id = cs.simulation_id
    WHERE cs.cohort_id = $1 AND cs.active = true
),
student_simulation_results AS (
    SELECT 
        cm.id as student_id,
        cs.id as simulation_id,
        best_results.best_score,
        best_results.passed,
        best_results.time_taken,
        best_results.attempt_count,
        best_results.last_attempt
    FROM cohort_members cm
    CROSS JOIN cohort_sims cs
    LEFT JOIN LATERAL (
        WITH student_attempts AS (
            SELECT sa.id AS attempt_id, sa.created_at
            FROM simulation_attempts sa
            JOIN attempt_profiles ap ON sa.id = ap.attempt_id
            WHERE ap.profile_id = cm.id
              AND ap.active = true
              AND sa.simulation_id = cs.id
        ),
        chat_grades AS (
            SELECT 
                sa.attempt_id,
                sa.created_at,
                scg.score,
                scg.passed,
                scg.time_taken,
                ROW_NUMBER() OVER (
                    PARTITION BY sa.attempt_id 
                    ORDER BY sc.created_at DESC
                ) as rn
            FROM student_attempts sa
            JOIN attempt_chats ac ON ac.attempt_id = sa.attempt_id
            JOIN simulation_chats sc ON sc.id = ac.chat_id
            JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
        )
        SELECT 
            MAX(score) as best_score,
            BOOL_OR(passed) as passed,
            (ARRAY_AGG(time_taken ORDER BY score DESC))[1] as time_taken,
            COUNT(DISTINCT attempt_id) as attempt_count,
            MAX(created_at) as last_attempt
        FROM chat_grades
        WHERE rn = 1
    ) best_results ON true
)
SELECT 
    c.id,
    c.title,
    c.description,
    c.active,
    c.created_at,
    COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'id', cm.id,
            'first_name', cm.first_name,
            'last_name', cm.last_name,
            'emails', COALESCE(cm.emails, ARRAY[]::text[]),
            'primaryEmail', cm.primary_email
        )) FILTER (WHERE cm.id IS NOT NULL),
        '[]'::json
    ) as members,
    COALESCE(
        json_agg(DISTINCT jsonb_build_object(
            'id', cs.id,
            'title', cs.title,
            'active', cs.active,
            'time_limit', cs.time_limit
        )) FILTER (WHERE cs.id IS NOT NULL),
        '[]'::json
    ) as simulations,
    COALESCE(
        (SELECT jsonb_object_agg(
            ssr.student_id::text,
            jsonb_object_agg(
                ssr.simulation_id::text,
                CASE 
                    WHEN ssr.best_score IS NOT NULL THEN
                        jsonb_build_object(
                            'score', ssr.best_score,
                            'passed', ssr.passed,
                            'time_taken', ssr.time_taken,
                            'attempt_count', ssr.attempt_count,
                            'last_attempt', ssr.last_attempt
                        )
                    ELSE NULL
                END
            )
         )
         FROM (
             SELECT 
                 student_id,
                 simulation_id,
                 best_score,
                 passed,
                 time_taken,
                 attempt_count,
                 last_attempt
             FROM student_simulation_results
         ) ssr
         GROUP BY ssr.student_id
        ),
        '{}'::jsonb
    ) as student_results
FROM cohorts c
LEFT JOIN cohort_members cm ON true
LEFT JOIN cohort_sims cs ON true
WHERE c.id = $1
GROUP BY c.id, c.title, c.description, c.active, c.created_at;

