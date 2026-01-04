-- Update the resolved status of a feedback entry
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_resolve_feedback_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_resolve_feedback_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_resolve_feedback_v4(
    feedback_id uuid,
    resolved boolean
)
RETURNS TABLE (
    id uuid,
    resolved boolean
)
LANGUAGE sql
VOLATILE
AS $$
UPDATE feedback
SET resolved = api_resolve_feedback_v4.resolved
WHERE id = feedback_id
RETURNING id, resolved
$$;