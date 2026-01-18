-- Get rubric grade agent details
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_rubric_grade_agent_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_rubric_grade_agent_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_rubric_grade_agent_v4(
    rubric_grade_agent_id uuid
)
RETURNS TABLE (
    grade_agent_id text,
    rubric_id text,
    agent_id text
)
LANGUAGE sql
STABLE
AS $$
    -- rubric_grade_agents removed - return NULL values (function kept for API compatibility)
    SELECT 
        NULL::text as grade_agent_id,
        NULL::text as rubric_id,
        NULL::text as agent_id
    WHERE false
$$;
