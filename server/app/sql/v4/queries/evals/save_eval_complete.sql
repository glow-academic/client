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

-- Drop input types for run/group rubrics
DO $$
BEGIN
    DROP TYPE IF EXISTS types.q_save_eval_v4_run_rubric_link;
    DROP TYPE IF EXISTS types.q_save_eval_v4_group_rubric_link;
END $$;

-- Create input types for run/group rubrics
CREATE TYPE types.q_save_eval_v4_run_rubric_link AS (
    run_id uuid,
    rubric_ids uuid[]
);

CREATE TYPE types.q_save_eval_v4_group_rubric_link AS (
    group_id uuid,
    rubric_ids uuid[]
);

CREATE OR REPLACE FUNCTION api_save_eval_v4(
    name text,
    agent_ids uuid[],
    profile_id uuid,
    description text DEFAULT NULL,
    use_groups boolean DEFAULT false,
    model_run_ids uuid[] DEFAULT ARRAY[]::uuid[],
    group_ids uuid[] DEFAULT ARRAY[]::uuid[],
    run_rubric_links types.q_save_eval_v4_run_rubric_link[] DEFAULT ARRAY[]::types.q_save_eval_v4_run_rubric_link[],
    group_rubric_links types.q_save_eval_v4_group_rubric_link[] DEFAULT ARRAY[]::types.q_save_eval_v4_group_rubric_link[],
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
        DELETE FROM eval_names_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_descriptions_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_departments_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_agents_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_runs_rubrics_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_groups_rubrics_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_runs_junction WHERE eval_id = v_eval_id;
        DELETE FROM eval_groups_junction WHERE eval_id = v_eval_id;
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
            COALESCE(group_ids, ARRAY[]::uuid[]) AS group_ids,
            COALESCE(run_rubric_links, ARRAY[]::types.q_save_eval_v4_run_rubric_link[]) AS run_rubric_links,
            COALESCE(group_rubric_links, ARRAY[]::types.q_save_eval_v4_group_rubric_link[]) AS group_rubric_links,
            profile_id
    ),
    -- Insert name INTO names_resource table and get ID
    name_resource AS (
        INSERT INTO names_resource (name, created_at)
        SELECT name, NOW()
        FROM params
        WHERE name IS NOT NULL AND name != ''
        ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
        RETURNING id as name_id
    ),
    -- Insert description INTO descriptions_resource table and get ID
    description_resource AS (
        INSERT INTO descriptions_resource (description, created_at)
        SELECT description, NOW()
        FROM params
        WHERE description IS NOT NULL AND description != ''
        ON CONFLICT (description) DO UPDATE SET created_at = EXCLUDED.created_at
        RETURNING id as description_id
    ),
    user_profile AS (
        SELECT role, actor_name
        FROM view_user_profile_context
        WHERE profile_id = (SELECT profile_id FROM params)
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM eval_departments_junction
        WHERE eval_departments_junction.eval_id = (SELECT p.eval_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments_junction
        WHERE profile_departments_junction.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
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
        INSERT INTO eval_names_junction (eval_id, name_id, created_at)
        SELECT 
            x.eval_id,
            nr.name_id,
            NOW()
        FROM params x
        CROSS JOIN name_resource nr
        WHERE nr.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT eval_names_pkey DO NOTHING
    ),
    -- Link eval to description
    link_eval_description AS (
        INSERT INTO eval_descriptions_junction (eval_id, description_id, created_at)
        SELECT 
            x.eval_id,
            dr.description_id,
            NOW()
        FROM params x
        CROSS JOIN description_resource dr
        WHERE dr.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT eval_descriptions_pkey DO NOTHING
    ),
    -- Insert or UPDATE eval_artifact active flag
    insert_eval_active_flag AS (
        INSERT INTO eval_flags_junction (eval_id, flag_id, value, created_at) SELECT x.eval_id,
            f.id,
            x.active,
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'eval_active'
        ON CONFLICT ON CONSTRAINT eval_flags_pkey DO UPDATE SET 
            value = EXCLUDED.value
    ),
    -- Insert or UPDATE eval_artifact dynamic flag
    insert_eval_dynamic_flag AS (
        INSERT INTO eval_flags_junction (eval_id, flag_id, type, value, created_at)
        SELECT 
            x.eval_id,
            f.id,
            x.dynamic,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'dynamic'
        ON CONFLICT ON CONSTRAINT eval_flags_pkey DO UPDATE SET 
            value = EXCLUDED.value
    ),
    -- Insert or UPDATE eval_artifact groups_entry flag
    insert_eval_groups_flag AS (
        INSERT INTO eval_flags_junction (eval_id, flag_id, type, value, created_at)
        SELECT 
            x.eval_id,
            f.id,
            x.use_groups,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'groups_entry'
        ON CONFLICT ON CONSTRAINT eval_flags_pkey DO UPDATE SET 
            value = EXCLUDED.value
    ),
    -- Link departments (old ones already deleted above if update)
    link_departments AS (
        INSERT INTO eval_departments_junction (eval_id, department_id, active, created_at)
        SELECT 
            x.eval_id,
            dept_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT eval_departments_pkey DO UPDATE SET
            active = true
    ),
    -- Link agents (old ones already deleted above if update)
    link_agents AS (
        INSERT INTO eval_agents_junction (eval_id, agent_id, created_at)
        SELECT 
            x.eval_id,
            agent_id,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.agent_ids) as agent_id
        WHERE COALESCE(array_length(x.agent_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT eval_agents_pkey DO NOTHING
    ),
    -- Link model runs_entry (old ones already deleted above if update)
    link_runs AS (
        INSERT INTO eval_runs_junction (eval_id, run_id, completed, created_at)
        SELECT 
            x.eval_id,
            run_id,
            false,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.model_run_ids) as run_id
        WHERE x.use_groups = false
          AND COALESCE(array_length(x.model_run_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT eval_runs_pkey DO UPDATE SET
            completed = false
    ),
    -- Link groups_entry when using groups_entry
    link_groups AS (
        INSERT INTO eval_groups_junction (eval_id, group_id, created_at)
        SELECT
            x.eval_id,
            group_id,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.group_ids) as group_id
        WHERE x.use_groups = true
          AND COALESCE(array_length(x.group_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT eval_groups_pkey DO NOTHING
    ),
    -- Create run_rubrics_resource entries
    create_run_rubrics AS (
        INSERT INTO run_rubrics_resource (run_id, rubric_id, created_at, generated, mcp, active)
        SELECT DISTINCT
            rr.runs_id,
            rubric_id,
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN LATERAL UNNEST(x.run_rubric_links) AS rr(run_id uuid, rubric_ids uuid[])
        CROSS JOIN LATERAL UNNEST(rr.rubric_ids) AS rubric_id
        WHERE x.use_groups = false
          AND COALESCE(array_length(rr.rubric_ids, 1), 0) > 0
        ON CONFLICT (run_id, rubric_id) DO UPDATE SET active = EXCLUDED.active
        RETURNING id
    ),
    -- Link run_rubrics to eval
    link_run_rubrics AS (
        INSERT INTO eval_runs_rubrics_junction (eval_id, run_rubric_id, created_at, generated, mcp, active)
        SELECT
            x.eval_id,
            crr.id,
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN create_run_rubrics crr
        WHERE x.use_groups = false
        ON CONFLICT (eval_id, run_rubric_id) DO UPDATE SET
            active = true
    ),
    -- Create group_rubrics_resource entries
    create_group_rubrics AS (
        INSERT INTO group_rubrics_resource (rubric_id, created_at, generated, mcp, active)
        SELECT DISTINCT
            gr.group_id,
            rubric_id,
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN LATERAL UNNEST(x.group_rubric_links) AS gr(group_id uuid, rubric_ids uuid[])
        CROSS JOIN LATERAL UNNEST(gr.rubric_ids) AS rubric_id
        WHERE x.use_groups = true
          AND COALESCE(array_length(gr.rubric_ids, 1), 0) > 0
        ON CONFLICT (group_id, rubric_id) DO UPDATE SET active = EXCLUDED.active
        RETURNING id
    ),
    -- Link group_rubrics to eval
    link_group_rubrics AS (
        INSERT INTO eval_groups_rubrics_junction (eval_id, group_rubric_id, created_at, generated, mcp, active)
        SELECT
            x.eval_id,
            cgr.id,
            NOW(),
            false,
            false,
            true
        FROM params x
        CROSS JOIN create_group_rubrics cgr
        WHERE x.use_groups = true
        ON CONFLICT (eval_id, group_rubric_id) DO UPDATE SET
            active = true
    ),
    -- Sync linked resources with name/description
    sync_artifact_resources AS (
        UPDATE evals_resource r
        SET name = p.name,
            description = p.description
        FROM eval_evals_junction j
        CROSS JOIN params p
        WHERE j.evals_id = r.id
          AND j.eval_id = p.eval_id
        RETURNING r.id
    )
    SELECT
        x.eval_id AS eval_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
