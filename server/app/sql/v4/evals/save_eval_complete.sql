-- Unified save eval function - handles both create (eval_id = NULL) and update (eval_id provided)
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_save_eval_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_eval_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_eval_v4(
    name text,
    agent_ids uuid[],
    profile_id uuid,
    description text DEFAULT NULL,
    use_groups boolean DEFAULT false,
    model_run_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    active boolean DEFAULT true,
    dynamic boolean DEFAULT false,
    input_eval_id uuid DEFAULT NULL
)
RETURNS TABLE (
    eval_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_eval_id uuid;
    v_actor_name text;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_eval_id IS NULL);
    
    -- Create or UPDATE eval_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO eval_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_eval_id;
    ELSE
        -- UPDATE path
        v_eval_id := input_eval_id;
        UPDATE eval_artifact
        SET updated_at = NOW()
        WHERE id = v_eval_id;
    END IF;
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM eval_names WHERE eval_id = v_eval_id;
        DELETE FROM eval_descriptions WHERE eval_id = v_eval_id;
        DELETE FROM eval_departments WHERE eval_id = v_eval_id;
        DELETE FROM eval_agents WHERE eval_id = v_eval_id;
        DELETE FROM eval_runs WHERE eval_id = v_eval_id;
        -- Note: eval_rubrics handled separately via eval_runs_rubric_grade_agents/eval_groups_rubric_grade_agents
    END IF;
    
    -- Continue with eval save using SQL (eval already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_eval_id AS eval_id,
            name AS name,
            description AS description,
            COALESCE(active, true) AS active,
            COALESCE(dynamic, false) AS dynamic,
            COALESCE(use_groups, false) AS use_groups,
            COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
            COALESCE(agent_ids, ARRAY[]::uuid[]) AS agent_ids,
            COALESCE(model_run_ids, ARRAY[]::uuid[]) AS model_run_ids,
            profile_id
    ),
    -- Insert name INTO names_resource table and get ID
    name_resource AS (
        INSERT INTO names_resource (name, created_at, updated_at)
        SELECT name, NOW(), NOW()
        FROM params
        WHERE name IS NOT NULL AND name != ''
        ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
        RETURNING id as name_id
    ),
    -- Insert description INTO descriptions_resource table and get ID
    description_resource AS (
        INSERT INTO descriptions_resource (description, created_at, updated_at)
        SELECT description, NOW(), NOW()
        FROM params
        WHERE description IS NOT NULL AND description != ''
        ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
        RETURNING id as description_id
    ),
    user_profile AS (
        SELECT 
            (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
            COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
        FROM params x
        JOIN profile_artifact p ON p.id = x.profile_id
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM eval_departments
        WHERE eval_departments.eval_id = (SELECT p.eval_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments
        WHERE profile_departments.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT 
            CASE 
                WHEN (SELECT p.eval_id FROM params p) IS NULL THEN
                    -- Validate create permissions
                    (SELECT validate_department_create_permissions(
                        up.role::text,
                        x.department_ids::text[]
                    ) FROM params x CROSS JOIN user_profile up)
                ELSE
                    -- Validate update permissions
                    (SELECT validate_department_update_permissions(
                        up.role::text,
                        ocd.department_ids,
                        ud.department_ids
                    ) FROM user_profile up
                    CROSS JOIN object_current_departments ocd
                    CROSS JOIN user_departments ud)
            END as validation_passed
    ),
    actor_profile AS (
        SELECT 
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link eval to name
    link_eval_name AS (
        INSERT INTO eval_names (eval_id, name_id, created_at, updated_at)
        SELECT 
            x.eval_id,
            nr.name_id,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN name_resource nr
        WHERE nr.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT eval_names_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link eval to description
    link_eval_description AS (
        INSERT INTO eval_descriptions (eval_id, description_id, created_at, updated_at)
        SELECT 
            x.eval_id,
            dr.description_id,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN description_resource dr
        WHERE dr.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT eval_descriptions_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Insert or UPDATE eval_artifact active flag
    insert_eval_active_flag AS (
        INSERT INTO eval_flags (eval_id, flag_id, type, value, created_at, updated_at)
        SELECT 
            x.eval_id,
            f.id,
            'active'::type_eval_flags,
            x.active,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'active'
        ON CONFLICT ON CONSTRAINT eval_flags_pkey DO UPDATE SET 
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Insert or UPDATE eval_artifact dynamic flag
    insert_eval_dynamic_flag AS (
        INSERT INTO eval_flags (eval_id, flag_id, type, value, created_at, updated_at)
        SELECT 
            x.eval_id,
            f.id,
            'dynamic'::type_eval_flags,
            x.dynamic,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'dynamic'
        ON CONFLICT ON CONSTRAINT eval_flags_pkey DO UPDATE SET 
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Insert or UPDATE eval_artifact groups flag
    insert_eval_groups_flag AS (
        INSERT INTO eval_flags (eval_id, flag_id, type, value, created_at, updated_at)
        SELECT 
            x.eval_id,
            f.id,
            'groups'::type_eval_flags,
            x.use_groups,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'groups'
        ON CONFLICT ON CONSTRAINT eval_flags_pkey DO UPDATE SET 
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Link departments (old ones already deleted above if update)
    link_departments AS (
        INSERT INTO eval_departments (eval_id, department_id, active, created_at, updated_at)
        SELECT 
            x.eval_id,
            dept_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT eval_departments_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    -- Link agents (old ones already deleted above if update)
    link_agents AS (
        INSERT INTO eval_agents (eval_id, agent_id, created_at, updated_at)
        SELECT 
            x.eval_id,
            agent_id,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.agent_ids) as agent_id
        WHERE COALESCE(array_length(x.agent_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT eval_agents_pkey DO UPDATE SET
            updated_at = NOW()
    ),
    -- Link model runs (old ones already deleted above if update)
    link_runs AS (
        INSERT INTO eval_runs (eval_id, run_id, completed, created_at, updated_at)
        SELECT 
            x.eval_id,
            run_id,
            false,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.model_run_ids) as run_id
        WHERE COALESCE(array_length(x.model_run_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT eval_runs_pkey DO UPDATE SET
            completed = false,
            updated_at = NOW()
    )
    -- Note: Rubrics are linked via eval_runs_rubric_grade_agents/eval_groups_rubric_grade_agents
    -- which is handled separately in the frontend/API layer based on groups flag
    SELECT 
        x.eval_id AS eval_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
