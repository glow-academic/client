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
WITH run_rubric AS (
    SELECT 
        errga.rubric_grade_agent_id::uuid as rubric_grade_agent_id
    FROM eval_runs_rubric_grade_agents errga
    WHERE errga.eval_id = eval_id 
      AND errga.run_id = run_id
      AND use_groups = false
    ORDER BY errga.created_at ASC
    LIMIT 1
),
group_rubric AS (
    SELECT 
        egga.rubric_grade_agent_id::uuid as rubric_grade_agent_id
    FROM eval_groups_rubric_grade_agents egga
    WHERE egga.eval_id = eval_id 
      AND egga.group_id = group_id
      AND use_groups = true
    ORDER BY egga.created_at ASC
    LIMIT 1
)
SELECT 
    COALESCE(rr.rubric_grade_agent_id, gr.rubric_grade_agent_id) as rubric_grade_agent_id
FROM run_rubric rr
FULL OUTER JOIN group_rubric gr ON true
$$;