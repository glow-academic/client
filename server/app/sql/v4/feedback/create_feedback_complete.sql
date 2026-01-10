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
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM profile p
    WHERE p.id = profile_id
),
new_feedback AS (
    INSERT INTO problems (type, message, profile_id, created_at)
    VALUES (type, message, profile_id, NOW())
    RETURNING id as feedback_id
)
SELECT 
    nf.feedback_id,
    ap.actor_name
FROM new_feedback nf
CROSS JOIN actor_profile ap
$$;