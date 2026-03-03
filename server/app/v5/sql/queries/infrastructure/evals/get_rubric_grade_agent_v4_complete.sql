-- Get rubric_id and grade_agent_id from rubric_grade_agent
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'infrastructure_evals_get_rubric_grade_agent_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS infrastructure_evals_get_rubric_grade_agent_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION infrastructure_evals_get_rubric_grade_agent_v4(
    rubric_grade_agent_id uuid
)
RETURNS TABLE (
    rubric_id text,
    eval_agent_id text
)
LANGUAGE sql
STABLE
AS $$
    -- rubric_grade_agents removed - return NULL values (function kept for API compatibility)
    SELECT 
        NULL::text as rubric_id,
        NULL::text as eval_agent_id
    WHERE false
$$;
