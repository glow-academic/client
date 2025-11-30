-- Get profile overview with latest grades
-- Supports searching by UUID or name (first_name, last_name, email)
-- Params: $1 = profile_id_or_name, $2 = search_pattern, $3 = limit
WITH profile_match AS (
    SELECT p.id
    FROM profiles p
    WHERE p.id::text = $1 
        OR LOWER(p.first_name) LIKE $2
        OR LOWER(p.last_name) LIKE $2
        OR EXISTS (SELECT 1 FROM profile_emails WHERE profile_id = p.id AND active = true AND LOWER(email) LIKE $2)
    LIMIT 1
),
latest_attempts AS (
    SELECT sa.id as attempt_id, sa.simulation_id, sa.created_at
    FROM simulation_attempts sa
    JOIN attempt_profiles ap ON ap.attempt_id = sa.id
    JOIN profile_match pm ON pm.id = ap.profile_id
    WHERE ap.active = true
    ORDER BY sa.created_at DESC
    LIMIT $3
),
attempt_grades AS (
    SELECT 
        s.title as simulation_title,
        scg.score,
        scg.passed,
        scg.time_taken,
        scg.created_at,
        ROW_NUMBER() OVER (PARTITION BY la.attempt_id ORDER BY sc.created_at DESC) as rn
    FROM latest_attempts la
    JOIN simulations s ON s.id = la.simulation_id
    JOIN attempt_chats ac ON ac.attempt_id = la.attempt_id
    JOIN chats sc ON sc.id = ac.chat_id
    JOIN grades scg ON scg.eval = false
    JOIN runs r_profile ON r_profile.id = scg.run_id
    JOIN chat_runs rc_profile ON rc_profile.run_id = r_profile.id AND rc_profile.chat_id = sc.id
)
SELECT 
    p.id, p.first_name, p.last_name, 
    ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
    (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
    p.role, 
    p.last_login, p.active, p.created_at,
    COALESCE(
        (SELECT jsonb_agg(jsonb_build_object(
            'simulation_title', ag.simulation_title,
            'score', ag.score,
            'passed', ag.passed,
            'time_taken', ag.time_taken,
            'created_at', ag.created_at
        ) ORDER BY ag.created_at DESC)
        FROM attempt_grades ag
        WHERE ag.rn = 1),
        '[]'::jsonb
    ) as latest_grades
FROM profiles p
LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
JOIN profile_match pm ON pm.id = p.id
GROUP BY p.id, p.first_name, p.last_name, p.role, p.last_login, p.active, p.created_at;

