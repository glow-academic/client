-- Add eval runs with rubric_grade_agents per run
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_add_eval_runs_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_add_eval_runs_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE (drop dependent types first)
DO $$
BEGIN
    -- Drop i_add_eval_runs_v4_run first (depends on i_add_eval_runs_v4_rubric_grade_agent)
    DROP TYPE IF EXISTS types.i_add_eval_runs_v4_run;
    -- Then drop i_add_eval_runs_v4_rubric_grade_agent
    DROP TYPE IF EXISTS types.i_add_eval_runs_v4_rubric_grade_agent;
END $$;

-- 3) Create composite types
CREATE TYPE types.i_add_eval_runs_v4_rubric_grade_agent AS (
    rubric_id uuid,
    grade_agent_id uuid
);

CREATE TYPE types.i_add_eval_runs_v4_run AS (
    run_id uuid,
    rubric_grade_agents types.i_add_eval_runs_v4_rubric_grade_agent[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_add_eval_runs_v4(
    eval_id uuid,
    runs types.i_add_eval_runs_v4_run[],
    profile_id uuid
)
RETURNS TABLE (
    eval_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        eval_id AS eval_id,
        COALESCE(runs, ARRAY[]::types.i_add_eval_runs_v4_run[]) AS runs,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        role,
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
-- Create eval_runs entries
link_runs AS (
    INSERT INTO eval_runs (eval_id, run_id, completed, created_at, updated_at)
    SELECT 
        p.eval_id,
        (r).run_id,
        false,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN UNNEST(p.runs) AS r
    WHERE (r).run_id IS NOT NULL
    ON CONFLICT (eval_id, run_id) DO UPDATE SET
        completed = false,
        updated_at = NOW()
),
-- Create/find rubric_grade_agents entries
create_rubric_grade_agents AS (
    INSERT INTO rubric_grade_agents (rubric_id, grade_agent_id, created_at, updated_at)
    SELECT DISTINCT
        (rga).rubric_id,
        (rga).grade_agent_id,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.runs) AS r
    CROSS JOIN UNNEST((r).rubric_grade_agents) AS rga
    WHERE (rga).rubric_id IS NOT NULL 
      AND (rga).grade_agent_id IS NOT NULL
    ON CONFLICT (rubric_id, grade_agent_id, agent_id) DO UPDATE SET
        updated_at = NOW()
    RETURNING id as rubric_grade_agent_id, rubric_id, grade_agent_id
),
-- Link rubric_grade_agents to runs
link_run_rubric_grade_agents AS (
    INSERT INTO eval_runs_rubric_grade_agents (eval_id, run_id, rubric_grade_agent_id, created_at, updated_at)
    SELECT DISTINCT
        p.eval_id,
        (r).run_id,
        crga.rubric_grade_agent_id,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN UNNEST(p.runs) AS r
    CROSS JOIN UNNEST((r).rubric_grade_agents) AS rga
    JOIN create_rubric_grade_agents crga ON crga.rubric_id = (rga).rubric_id 
        AND crga.grade_agent_id = (rga).grade_agent_id
    WHERE (r).run_id IS NOT NULL
      AND (rga).rubric_id IS NOT NULL 
      AND (rga).grade_agent_id IS NOT NULL
    ON CONFLICT (eval_id, run_id, rubric_grade_agent_id) DO NOTHING
)
SELECT 
    p.eval_id,
    up.actor_name::text as actor_name
FROM params p
CROSS JOIN user_profile up
$$;

COMMIT;

