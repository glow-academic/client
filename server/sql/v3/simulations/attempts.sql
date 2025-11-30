-- List all attempts for a simulation with grades
-- Params: $1 = simulation_id, $2 = limit
WITH attempt_data AS (
    SELECT 
        sa.id,
        sa.created_at,
        ap.profile_id,
        p.first_name,
        p.last_name,
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email
    FROM simulation_attempts sa
    LEFT JOIN attempt_profiles ap ON sa.id = ap.attempt_id AND ap.active = true
    LEFT JOIN profiles p ON p.id = ap.profile_id
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    WHERE sa.simulation_id = $1
    GROUP BY sa.id, sa.created_at, ap.profile_id, p.first_name, p.last_name
    ORDER BY sa.created_at DESC
    LIMIT $2
),
latest_grades AS (
    SELECT DISTINCT ON (ac.attempt_id)
        ac.attempt_id,
        scg.score,
        scg.passed,
        scg.time_taken
    FROM attempt_chats ac
    JOIN chats sc ON sc.id = ac.chat_id
    JOIN grades scg ON scg.eval = false
    JOIN runs r_attempts ON r_attempts.id = scg.run_id
    JOIN chat_runs rc_attempts ON rc_attempts.run_id = r_attempts.id AND rc_attempts.chat_id = sc.id
    WHERE ac.attempt_id IN (SELECT id FROM attempt_data)
    ORDER BY ac.attempt_id, sc.created_at DESC
)
SELECT 
    ad.id,
    ad.created_at,
    ad.profile_id,
    ad.first_name,
    ad.last_name,
    COALESCE(ad.emails, ARRAY[]::text[]) as emails,
    ad.primary_email,
    lg.score,
    lg.passed,
    lg.time_taken
FROM attempt_data ad
LEFT JOIN latest_grades lg ON lg.attempt_id = ad.id
ORDER BY ad.created_at DESC;

