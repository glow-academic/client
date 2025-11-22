-- List all attempts for a simulation with grades
-- Params: $1 = simulation_id, $2 = limit
WITH attempt_data AS (
    SELECT 
        sa.id,
        sa.created_at,
        ap.profile_id,
        p.first_name,
        p.last_name,
        p.email
    FROM simulation_attempts sa
    LEFT JOIN attempt_profiles ap ON sa.id = ap.attempt_id AND ap.active = true
    LEFT JOIN profiles p ON p.id = ap.profile_id
    WHERE sa.simulation_id = $1
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
    JOIN simulation_chats sc ON sc.id = ac.chat_id
    JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
    WHERE ac.attempt_id IN (SELECT id FROM attempt_data)
    ORDER BY ac.attempt_id, sc.created_at DESC
)
SELECT 
    ad.id,
    ad.created_at,
    ad.profile_id,
    ad.first_name,
    ad.last_name,
    ad.email,
    lg.score,
    lg.passed,
    lg.time_taken
FROM attempt_data ad
LEFT JOIN latest_grades lg ON lg.attempt_id = ad.id
ORDER BY ad.created_at DESC;

