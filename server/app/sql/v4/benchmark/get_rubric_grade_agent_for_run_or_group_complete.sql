-- Get rubric_grade_agent_id for a run or group
-- Converted to PostgreSQL function
-- If use_groups=false: queries eval_runs_rubric_grade_agents
-- If use_groups=true: queries eval_groups_rubric_grade_agents
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_rubric_grade_agent_for_run_or_group_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_rubric_grade_agent_for_run_or_group_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_rubric_grade_agent_for_run_or_group_v4(
    eval_id uuid,
    use_groups boolean,
    run_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL
)
RETURNS TABLE (
    rubric_grade_agent_id uuid
)
LANGUAGE sql
STABLE
AS $$
-- rubric_grade_agents removed - return NULL (function kept for API compatibility)
SELECT NULL::uuid as rubric_grade_agent_id WHERE false
$$;