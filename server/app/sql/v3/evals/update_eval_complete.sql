-- Update eval with optional runs and departments changes
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
        WHERE proname = 'api_update_eval_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_eval_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_update_eval_v3(
    eval_id uuid,
    name text,
    description text,
    rubric_id uuid,
    agent_id uuid,
    eval_agent_id uuid,
    model_run_ids uuid[],
    department_ids uuid[],
    active boolean,
    dynamic boolean,
    profile_id uuid
)
RETURNS TABLE (
    eval_id uuid,
    eval_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        eval_id AS eval_id,
        name AS name,
        description AS description,
        rubric_id AS rubric_id,
        agent_id AS agent_id,
        eval_agent_id AS eval_agent_id,
        COALESCE(model_run_ids, ARRAY[]::uuid[]) AS model_run_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        active AS active,
        dynamic AS dynamic,
        profile_id AS profile_id
),
user_profile AS (
    SELECT
        role,
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
object_current_departments AS (
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN eval_departments ON eval_departments.eval_id = x.eval_id AND eval_departments.active = true
),
user_departments AS (
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
validate_update_permissions AS (
    SELECT validate_department_update_permissions(
        up.role::text,
        ocd.department_ids,
        ud.department_ids
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN object_current_departments ocd
    CROSS JOIN user_departments ud
),
update_eval AS (
    UPDATE evals SET
        name = p.name,
        description = p.description,
        rubric_id = p.rubric_id,
        agent_id = COALESCE(p.agent_id, evals.agent_id),
        eval_agent_id = COALESCE(p.eval_agent_id, evals.eval_agent_id),
        active = COALESCE(p.active, evals.active),
        dynamic = COALESCE(p.dynamic, evals.dynamic),
        updated_at = NOW()
    FROM params p
    WHERE evals.id = p.eval_id
    RETURNING evals.id as eval_id, evals.name as eval_name
),
remove_existing_dept_links AS (
    DELETE FROM eval_departments
    USING params p
    WHERE eval_departments.eval_id = p.eval_id
    AND COALESCE(array_length(p.department_ids, 1), 0) > 0
),
add_new_dept_links AS (
    INSERT INTO eval_departments (eval_id, department_id, active, created_at, updated_at)
    SELECT 
        p.eval_id,
        d_id,
        true,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN UNNEST(p.department_ids) as d_id
    WHERE COALESCE(array_length(p.department_ids, 1), 0) > 0
    ON CONFLICT (eval_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
remove_existing_links AS (
    DELETE FROM eval_runs
    USING params p
    WHERE eval_runs.eval_id = p.eval_id
    AND COALESCE(array_length(p.model_run_ids, 1), 0) > 0
),
add_new_links AS (
    INSERT INTO eval_runs (eval_id, run_id, completed, created_at, updated_at)
    SELECT 
        p.eval_id,
        r_id,
        false,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN UNNEST(p.model_run_ids) as r_id
    WHERE COALESCE(array_length(p.model_run_ids, 1), 0) > 0
    ON CONFLICT (eval_id, run_id) DO UPDATE SET
        updated_at = NOW()
)
SELECT ue.eval_id, ue.eval_name, up.actor_name::text as actor_name
FROM update_eval ue
CROSS JOIN user_profile up
$$;

COMMIT;

