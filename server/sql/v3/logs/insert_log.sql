-- Insert log entry with guest-profile-id resolution (Chris Date: No Nulls)
-- Parameters: $1=level, $2=logger_name, $3=message, $4=profile_id (may be "guest-profile-id"), $5=extra (jsonb)
-- Resolves "guest-profile-id" to actual guest UUID before inserting
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $4::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            ELSE $4::uuid
        END as resolved_profile_id
)
INSERT INTO app_logs (
    level,
    logger_name,
    message,
    profile_id,
    extra,
    ts
)
SELECT 
    $1::text,
    $2::text,
    $3::text,
    resolved_profile_id,
    $5::jsonb,
    now()
FROM resolve_profile_id
RETURNING id
