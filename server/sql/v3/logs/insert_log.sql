-- Insert log entry with guest-profile-id resolution (Chris Date: No Nulls)
-- Parameters: $1=level, $2=logger_name, $3=message, $4=profile_id (may be "guest-profile-id"), $5=extra (jsonb)
-- Resolves "guest-profile-id" to actual guest UUID before inserting
-- Inserts into both app_logs and app_logs_profiles junction table
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $4::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND first_name = 'Default' ORDER BY created_at DESC LIMIT 1)
            ELSE $4::uuid
        END as resolved_profile_id
),
insert_log AS (
    INSERT INTO app_logs (
        level,
        logger_name,
        message,
        extra,
        ts
    )
    SELECT 
        $1::text,
        $2::text,
        $3::text,
        $5::jsonb,
        now()
    RETURNING id
)
INSERT INTO app_logs_profiles (app_log_id, profile_id, created_at, updated_at)
SELECT 
    il.id,
    rpi.resolved_profile_id,
    now(),
    now()
FROM insert_log il
CROSS JOIN resolve_profile_id rpi
WHERE rpi.resolved_profile_id IS NOT NULL
RETURNING app_log_id
