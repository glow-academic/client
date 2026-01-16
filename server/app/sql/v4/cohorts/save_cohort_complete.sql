-- Unified save cohort function - handles both create (cohort_id = NULL) and update (cohort_id provided)
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
        WHERE proname = 'api_save_cohort_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_cohort_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_cohort_v4(
    name_id uuid,
    department_ids uuid[],
    simulation_ids uuid[],
    profile_id uuid,
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    input_cohort_id uuid DEFAULT NULL
)
RETURNS TABLE (
    cohort_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_cohort_id uuid;
    v_actor_name text;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_cohort_id IS NULL);
    
    -- Create or UPDATE cohort_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO cohort_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_cohort_id;
    ELSE
        -- UPDATE path
        v_cohort_id := input_cohort_id;
        UPDATE cohort_artifact
        SET updated_at = NOW()
        WHERE id = v_cohort_id;
    END IF;
    
    -- Validate required resource IDs exist (same for both)
    IF name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;
    
    IF description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;
    
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM cohort_names WHERE cohort_id = v_cohort_id;
        DELETE FROM cohort_descriptions WHERE cohort_id = v_cohort_id;
        DELETE FROM cohort_departments WHERE cohort_id = v_cohort_id;
        DELETE FROM cohort_simulations WHERE cohort_id = v_cohort_id;
        -- Update existing active flag if it exists
        UPDATE cohort_flags SET
            flag_id = COALESCE(api_save_cohort_v4.active_flag_id, cohort_flags.flag_id),
            value = CASE WHEN api_save_cohort_v4.active_flag_id IS NOT NULL THEN true ELSE false END,
            updated_at = NOW()
        WHERE cohort_id = v_cohort_id
          ;
    END IF;
    
    -- Continue with cohort save using SQL (cohort already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_cohort_id AS cohort_id,
            name_id,
            description_id,
            active_flag_id,
            COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
            COALESCE(simulation_ids, ARRAY[]::uuid[]) AS simulation_ids,
            profile_id
    ),
    user_profile AS (
        SELECT 
            (SELECT r.role FROM profile_roles pr_j 
             JOIN roles_resource r ON pr_j.role_id = r.id 
             WHERE pr_j.profile_id = p.id 
             LIMIT 1) as role,
            COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
        FROM params x
        JOIN profile_artifact p ON p.id = x.profile_id
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM cohort_departments
        WHERE cohort_departments.cohort_id = (SELECT p.cohort_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments
        WHERE profile_departments.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT 
            CASE 
                WHEN (SELECT p.cohort_id FROM params p) IS NULL THEN
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
    -- Link cohort to name
    link_cohort_name AS (
        INSERT INTO cohort_names (cohort_id, name_id, created_at, updated_at)
        SELECT 
            x.cohort_id,
            x.name_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT cohort_names_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link cohort to description
    link_cohort_description AS (
        INSERT INTO cohort_descriptions (cohort_id, description_id, created_at, updated_at)
        SELECT 
            x.cohort_id,
            x.description_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT cohort_descriptions_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Insert or UPDATE cohort_artifact active flag (UPDATE handled above for update case, INSERT here handles both via ON CONFLICT)
    insert_cohort_active_flag AS (
        INSERT INTO cohort_flags (cohort_id, flag_id, value, created_at, updated_at) SELECT x.cohort_id,
            COALESCE(x.active_flag_id, f.id),
            'active'::type_cohort_flags,
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'active'
        ON CONFLICT ON CONSTRAINT cohort_flags_pkey DO UPDATE SET 
            flag_id = COALESCE(EXCLUDED.flag_id, cohort_flags.flag_id),
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Link departments (old ones already deleted above if update)
    link_departments AS (
        INSERT INTO cohort_departments (cohort_id, department_id, active, created_at, updated_at)
        SELECT 
            x.cohort_id,
            dept_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT cohort_departments_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    -- Simulations with position (old ones already deleted above if update)
    simulations_with_order AS (
        SELECT 
            sim_id,
            ROW_NUMBER() OVER () as position
        FROM params x
        CROSS JOIN UNNEST(x.simulation_ids) as sim_id
        WHERE COALESCE(array_length(x.simulation_ids, 1), 0) > 0
    ),
    link_simulations AS (
        INSERT INTO cohort_simulations (cohort_id, simulation_id, active, position)
        SELECT 
            x.cohort_id,
            swo.sim_id,
            true,
            swo.position
        FROM params x
        CROSS JOIN simulations_with_order swo
        ON CONFLICT ON CONSTRAINT cohort_simulations_pkey DO UPDATE SET
            active = true,
            position = EXCLUDED.position
    )
    SELECT 
        x.cohort_id AS cohort_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
