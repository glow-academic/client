-- Update eval with optional runs and departments changes
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
        WHERE proname = 'api_update_eval_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_eval_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_update_eval_v4(
    eval_id uuid,
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
        COALESCE(agent_ids, ARRAY[]::uuid[]) AS agent_ids,
        use_groups AS use_groups,
        COALESCE(model_run_ids, ARRAY[]::uuid[]) AS model_run_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        active AS active,
        dynamic AS dynamic,
        profile_id AS profile_id
),
user_profile AS (
    SELECT
        role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), 'System') as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
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
get_or_create_name AS (
    -- Get or create name in names table
    INSERT INTO names (name, created_at, updated_at)
    SELECT p.name, NOW(), NOW()
    FROM params p
    WHERE p.name IS NOT NULL AND p.name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id, name as name_value
),
get_or_create_description AS (
    -- Get or create description in descriptions table
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT p.description, NOW(), NOW()
    FROM params p
    WHERE p.description IS NOT NULL AND p.description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
get_active_flag AS (
    -- Get the active flag ID
    SELECT id as flag_id
    FROM flags
    WHERE name = 'active'
    LIMIT 1
),
get_dynamic_flag AS (
    -- Get the dynamic flag ID
    SELECT id as flag_id
    FROM flags
    WHERE name = 'dynamic'
    LIMIT 1
),
get_groups_flag AS (
    -- Get the groups flag ID
    SELECT id as flag_id
    FROM flags
    WHERE name = 'groups'
    LIMIT 1
),
update_eval AS (
    UPDATE eval SET
        updated_at = NOW()
    FROM params p
    WHERE eval.id = p.eval_id
    RETURNING eval.id as eval_id
),
update_eval_groups_flag AS (
    -- Update groups flag
    INSERT INTO eval_flags (eval_id, flag_id, type, value, created_at, updated_at)
    SELECT ue.eval_id, ggf.flag_id, 'groups'::type_eval_flags, COALESCE(p.use_groups, EXISTS (SELECT 1 FROM eval_flags ef WHERE ef.eval_id = ue.eval_id AND ef.type = 'groups'::type_eval_flags AND ef.value = TRUE)), NOW(), NOW()
    FROM update_eval ue
    CROSS JOIN get_groups_flag ggf
    CROSS JOIN params p
    ON CONFLICT (eval_id, flag_id, type) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
),
update_eval_name AS (
    -- Update eval name (delete old, insert new)
    DELETE FROM eval_names
    WHERE eval_id = (SELECT eval_id FROM update_eval LIMIT 1)
    RETURNING eval_id
),
link_eval_name AS (
    -- Link new name to eval
    INSERT INTO eval_names (eval_id, name_id, created_at, updated_at)
    SELECT ue.eval_id, gocn.name_id, NOW(), NOW()
    FROM update_eval ue
    CROSS JOIN get_or_create_name gocn
    WHERE gocn.name_id IS NOT NULL
),
update_eval_description AS (
    -- Update eval description (delete old, insert new if provided)
    DELETE FROM eval_descriptions
    WHERE eval_id = (SELECT eval_id FROM update_eval LIMIT 1)
    RETURNING eval_id
),
link_eval_description AS (
    -- Link new description to eval (if provided)
    INSERT INTO eval_descriptions (eval_id, description_id, created_at, updated_at)
    SELECT ue.eval_id, gocd.description_id, NOW(), NOW()
    FROM update_eval ue
    CROSS JOIN get_or_create_description gocd
    WHERE gocd.description_id IS NOT NULL
),
update_eval_active_flag AS (
    -- Update active flag
    INSERT INTO eval_flags (eval_id, flag_id, type, value, created_at, updated_at)
    SELECT ue.eval_id, gaf.flag_id, 'active'::type_eval_flags, COALESCE(p.active, EXISTS (SELECT 1 FROM eval_flags ef WHERE ef.eval_id = ue.eval_id AND ef.type = 'active'::type_eval_flags AND ef.value = TRUE)), NOW(), NOW()
    FROM update_eval ue
    CROSS JOIN get_active_flag gaf
    CROSS JOIN params p
    ON CONFLICT (eval_id, flag_id, type) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
),
update_eval_dynamic_flag AS (
    -- Update dynamic flag
    INSERT INTO eval_flags (eval_id, flag_id, type, value, created_at, updated_at)
    SELECT ue.eval_id, gdf.flag_id, 'dynamic'::type_eval_flags, COALESCE(p.dynamic, EXISTS (SELECT 1 FROM eval_flags ef WHERE ef.eval_id = ue.eval_id AND ef.type = 'dynamic'::type_eval_flags AND ef.value = TRUE)), NOW(), NOW()
    FROM update_eval ue
    CROSS JOIN get_dynamic_flag gdf
    CROSS JOIN params p
    ON CONFLICT (eval_id, flag_id, type) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
),
eval_with_name AS (
    -- Get eval_id and name for RETURNING clause
    SELECT ue.eval_id, COALESCE(gocn.name_value, (SELECT n.name FROM eval_names en JOIN names n ON en.name_id = n.id WHERE en.eval_id = ue.eval_id LIMIT 1)) as eval_name
    FROM update_eval ue
    LEFT JOIN get_or_create_name gocn ON true
),
remove_existing_agent_links AS (
    DELETE FROM eval_agents
    USING params p
    WHERE eval_agents.eval_id = p.eval_id
    AND COALESCE(array_length(p.agent_ids, 1), 0) > 0
),
add_new_agent_links AS (
    INSERT INTO eval_agents (eval_id, agent_id, created_at, updated_at)
    SELECT 
        p.eval_id,
        a_id,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN UNNEST(p.agent_ids) as a_id
    WHERE COALESCE(array_length(p.agent_ids, 1), 0) > 0
    ON CONFLICT (eval_id, agent_id) DO UPDATE SET
        updated_at = NOW()
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
SELECT ewn.eval_id, ewn.eval_name, up.actor_name::text as actor_name
FROM eval_with_name ewn
CROSS JOIN user_profile up
$$;