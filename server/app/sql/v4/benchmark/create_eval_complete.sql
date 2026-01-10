-- Create eval with runs junction table entries and departments in a single transaction
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_eval_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_eval_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_create_eval_v4(
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
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = profile.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = profile.id AND pn2.type = 'last' LIMIT 1), 'System') as actor_name
    FROM params x
    JOIN profile ON profile.id = x.profile_id
),
validate_create_permissions AS (
    SELECT validate_department_create_permissions(
        up.role::text,
        ARRAY(SELECT dept_id::text FROM UNNEST((SELECT department_ids FROM params)) as dept_id)
    ) as validation_passed
    FROM user_profile up
),
-- Insert name into names table and get ID
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    FROM params
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description into descriptions table and get ID
description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
new_eval AS (
    -- Create eval (without name/description/active/dynamic/use_groups columns)
    INSERT INTO eval (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM params
    RETURNING id as eval_id
),
-- Link eval to name
link_eval_name AS (
    INSERT INTO eval_names (eval_id, name_id, created_at, updated_at)
    SELECT 
        ne.eval_id,
        nr.name_id,
        NOW(),
        NOW()
    FROM new_eval ne
    CROSS JOIN name_resource nr
    ON CONFLICT (eval_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link eval to description
link_eval_description AS (
    INSERT INTO eval_descriptions (eval_id, description_id, created_at, updated_at)
    SELECT 
        ne.eval_id,
        dr.description_id,
        NOW(),
        NOW()
    FROM new_eval ne
    CROSS JOIN description_resource dr
    ON CONFLICT (eval_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link eval active flag
link_eval_active_flag AS (
    INSERT INTO eval_flags (eval_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        ne.eval_id,
        f.id,
        'active'::type_eval_flags,
        x.active,
        NOW(),
        NOW()
    FROM new_eval ne
    CROSS JOIN params x
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (eval_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- Link eval dynamic flag
link_eval_dynamic_flag AS (
    INSERT INTO eval_flags (eval_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        ne.eval_id,
        f.id,
        'dynamic'::type_eval_flags,
        x.dynamic,
        NOW(),
        NOW()
    FROM new_eval ne
    CROSS JOIN params x
    CROSS JOIN flags f
    WHERE f.name = 'dynamic'
    ON CONFLICT (eval_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
),
-- Link eval use_groups flag (renamed to groups)
link_eval_groups_flag AS (
    INSERT INTO eval_flags (eval_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        ne.eval_id,
        f.id,
        'groups'::type_eval_flags,
        x.use_groups,
        NOW(),
        NOW()
    FROM new_eval ne
    CROSS JOIN params x
    CROSS JOIN flags f
    WHERE f.name = 'groups'
    ON CONFLICT (eval_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
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