-- Create feedback entry
-- Converted to PostgreSQL function
-- profile_id is always a UUID (required in request body)
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_feedback_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_feedback_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_create_feedback_v4(
    type feedback_type,
    message text,
    profile_id uuid
)
RETURNS TABLE (
    feedback_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH actor_profile AS (
    SELECT 
        profile_id as resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = profile_id
),
new_feedback AS (
    INSERT INTO feedback (type, message, profile_id, created_at)
    VALUES (type, message, profile_id, NOW())
    RETURNING id as feedback_id
)
SELECT 
    nf.feedback_id,
    ap.actor_name
FROM new_feedback nf
CROSS JOIN actor_profile ap
$$;