-- Create eval with runs junction table entries and departments in a single transaction
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
        WHERE proname = 'api_create_eval_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_eval_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_create_eval_v3(
    name text,
    description text,
    agent_ids uuid[],
    use_groups boolean,
    model_run_ids uuid[],
    department_ids uuid[],
    active boolean,
    dynamic boolean,
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
        name AS name,
        description AS description,
        COALESCE(agent_ids, ARRAY[]::uuid[]) AS agent_ids,
        COALESCE(use_groups, false) AS use_groups,
        model_run_ids AS model_run_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(active, true) AS active,
        COALESCE(dynamic, false) AS dynamic,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        role,
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
validate_create_permissions AS (
    SELECT validate_department_create_permissions(
        up.role::text,
        ARRAY(SELECT dept_id::text FROM UNNEST((SELECT department_ids FROM params)) as dept_id)
    ) as validation_passed
    FROM user_profile up
),
new_eval AS (
    INSERT INTO evals (name, description, use_groups, active, dynamic, created_at, updated_at)
    SELECT name, description, use_groups, active, dynamic, NOW(), NOW()
    FROM params
    RETURNING id as eval_id
),
link_agents AS (
    INSERT INTO eval_agents (eval_id, agent_id, created_at, updated_at)
    SELECT 
        ne.eval_id,
        a_id,
        NOW(),
        NOW()
    FROM new_eval ne
    CROSS JOIN params p
    CROSS JOIN UNNEST(p.agent_ids) as a_id
    WHERE COALESCE(array_length(p.agent_ids, 1), 0) > 0
    ON CONFLICT (eval_id, agent_id) DO UPDATE SET
        updated_at = NOW()
),
link_departments AS (
    INSERT INTO eval_departments (eval_id, department_id, active, created_at, updated_at)
    SELECT 
        ne.eval_id,
        d_id,
        true,
        NOW(),
        NOW()
    FROM new_eval ne
    CROSS JOIN params p
    CROSS JOIN UNNEST(p.department_ids) as d_id
    WHERE COALESCE(array_length(p.department_ids, 1), 0) > 0
    ON CONFLICT (eval_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_runs AS (
    INSERT INTO eval_runs (eval_id, run_id, completed, created_at, updated_at)
    SELECT 
        ne.eval_id,
        r_id,
        false,
        NOW(),
        NOW()
    FROM new_eval ne
    CROSS JOIN params p
    CROSS JOIN UNNEST(p.model_run_ids) as r_id
    WHERE COALESCE(array_length(p.model_run_ids, 1), 0) > 0
    ON CONFLICT (eval_id, run_id) DO UPDATE SET
        completed = false,
        updated_at = NOW()
)
SELECT 
    ne.eval_id,
    up.actor_name::text as actor_name
FROM new_eval ne
CROSS JOIN user_profile up
$$;

COMMIT;
