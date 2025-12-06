-- Get complete student simulation report with attempts, chats, grades, messages, and feedback
-- Params: $1 = profile_id, $2 = recent (limit messages per chat)
WITH profile_info AS (
    SELECT 
        p.id, 
        p.first_name, 
        p.last_name, 
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
        p.role, 
        p.created_at
    FROM profiles p
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    WHERE p.id = $1
    GROUP BY p.id, p.first_name, p.last_name, p.role, p.created_at
),
attempt_chats AS (
    SELECT 
        sa.id as attempt_id,
        sa.created_at as attempt_created_at,
        s.id as simulation_id,
        s.title as simulation_title,
        sc.id as chat_id,
        sc.title as chat_title,
        sc.completed as chat_completed,
        sc.created_at as chat_created_at,
        scn.id as scenario_id,
        scn.name as scenario_name,
        ps.problem_statement as scenario_description,
        scg.id as grade_id,
        scg.score,
        scg.passed,
        scg.time_taken,
        scg.created_at as grade_created_at
    FROM simulation_attempts sa
    JOIN attempt_profiles ap ON sa.id = ap.attempt_id
    JOIN simulations s ON s.id = sa.simulation_id
    LEFT JOIN attempt_chats ac ON ac.attempt_id = sa.id
    LEFT JOIN chats sc ON sc.id = ac.chat_id
    LEFT JOIN scenarios scn ON scn.id = sc.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = scn.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    LEFT JOIN grades scg ON scg.eval = false
    LEFT JOIN runs r_report ON r_report.id = scg.run_id
    LEFT JOIN chat_runs rc_report ON rc_report.run_id = r_report.id AND rc_report.chat_id = sc.id
    WHERE ap.profile_id = $1 AND ap.active = true
    ORDER BY sa.created_at, sc.created_at
),
chat_messages AS (
    SELECT 
        ac.chat_id,
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'created_at', sm.created_at,
                    'role', sm.role,
                    'content', sm.content,
                    'completed', sm.completed
                ) ORDER BY sm.created_at
            ) 
            FROM (
                SELECT m.created_at, m.role, m.content, m.completed
                FROM messages m
                JOIN message_runs mr ON mr.message_id = m.id
                JOIN chat_runs rc ON rc.run_id = mr.run_id
                WHERE rc.chat_id = ac.chat_id
                ORDER BY m.created_at DESC
                LIMIT $2
            ) sm),
            '[]'::jsonb
        ) as messages
    FROM attempt_chats ac
    WHERE ac.chat_id IS NOT NULL
    GROUP BY ac.chat_id
),
grade_feedbacks AS (
    SELECT 
        ac.grade_id,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'standard', st.name,
                    'points', scf.total,
                    'feedback', scf.feedback
                )
            ),
            '[]'::jsonb
        ) as feedback
    FROM attempt_chats ac
    LEFT JOIN feedbacks scf ON scf.grade_id = ac.grade_id
    LEFT JOIN standards st ON st.id = scf.standard_id
    WHERE ac.grade_id IS NOT NULL
    GROUP BY ac.grade_id
)
SELECT 
    pi.id,
    pi.first_name,
    pi.last_name,
    pi.emails,
    pi.primary_email,
    pi.role,
    pi.created_at,
    COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'simulation_id', ac.simulation_id::text,
                'title', ac.simulation_title,
                'scenario', CASE 
                    WHEN ac.scenario_id IS NOT NULL THEN 
                        jsonb_build_object(
                            'id', ac.scenario_id::text,
                            'name', ac.scenario_name,
                            'description', ac.scenario_description
                        )
                    ELSE '{}'::jsonb
                END,
                'chat', CASE 
                    WHEN ac.chat_id IS NOT NULL THEN
                        jsonb_build_object(
                            'id', ac.chat_id::text,
                            'title', ac.chat_title,
                            'completed', ac.chat_completed,
                            'messages', COALESCE(cm.messages, '[]'::jsonb),
                            'grade', CASE 
                                WHEN ac.grade_id IS NOT NULL THEN
                                    jsonb_build_object(
                                        'score', ac.score,
                                        'passed', ac.passed,
                                        'time_taken', ac.time_taken,
                                        'created_at', ac.grade_created_at
                                    )
                                ELSE '{}'::jsonb
                            END,
                            'feedback', COALESCE(gf.feedback, '[]'::jsonb)
                        )
                    ELSE '{}'::jsonb
                END
            ) ORDER BY ac.attempt_created_at, ac.chat_created_at
        )
        FROM attempt_chats ac
        LEFT JOIN chat_messages cm ON cm.chat_id = ac.chat_id
        LEFT JOIN grade_feedbacks gf ON gf.grade_id = ac.grade_id
        WHERE ac.chat_id IS NOT NULL),
        '[]'::jsonb
    ) as attempts
FROM profile_info pi;

