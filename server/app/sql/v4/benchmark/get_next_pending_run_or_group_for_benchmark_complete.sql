-- Get next pending run or group for benchmark attempt
-- Converted to PostgreSQL function
-- If use_groups=false: returns next incomplete run
-- If use_groups=true: returns next incomplete group
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_next_pending_run_or_group_for_benchmark_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_next_pending_run_or_group_for_benchmark_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_next_pending_run_or_group_for_benchmark_v4(
    attempt_id uuid,
    eval_id uuid,
    use_groups boolean
)
RETURNS TABLE (
    next_run_id uuid,
    next_group_id uuid,
    run_id uuid,
    group_id uuid
)
LANGUAGE sql
STABLE
AS $$
WITH attempt_data AS (
    SELECT 
        ea.eval_id,
        ea.infinite_mode
    FROM eval_attempts ea
    WHERE ea.id = attempt_id
),
next_run AS (
    SELECT 
        er.run_id::uuid as next_run_id,
        er.run_id::uuid as run_id,
        NULL::uuid as next_group_id,
        NULL::uuid as group_id
    FROM eval_runs er
    CROSS JOIN attempt_data ad
    WHERE er.eval_id = ad.eval_id 
      AND er.completed = false
      AND use_groups = false
    ORDER BY er.created_at ASC
    LIMIT 1
),
next_group AS (
    SELECT 
        NULL::uuid as next_run_id,
        NULL::uuid as run_id,
        eg.group_id::uuid as next_group_id,
        eg.group_id::uuid as group_id
    FROM eval_groups eg
    CROSS JOIN attempt_data ad
    WHERE eg.eval_id = ad.eval_id 
      AND NOT EXISTS (
          SELECT 1 FROM grade_groups gg 
          WHERE gg.group_id = eg.group_id
      )
      AND use_groups = true
    ORDER BY eg.created_at ASC
    LIMIT 1
)
SELECT 
    COALESCE(nr.next_run_id, ng.next_group_id) as next_run_id,
    COALESCE(nr.next_group_id, ng.next_group_id) as next_group_id,
    COALESCE(nr.run_id, ng.run_id) as run_id,
    COALESCE(nr.group_id, ng.group_id) as group_id
FROM next_run nr
FULL OUTER JOIN next_group ng ON true
LIMIT 1
$$;