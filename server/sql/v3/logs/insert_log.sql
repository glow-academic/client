-- Insert log entry (Chris Date: No Nulls)
-- Parameters: $1=level, $2=logger_name, $3=message, $4=profile_id (uuid or NULL), $5=extra (jsonb)
-- Inserts into both app_logs and app_logs_profiles junction table
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $4::text IS NULL OR $4::text = '' THEN NULL::uuid
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
