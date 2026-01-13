-- Unified save rubric function - handles both create (rubric_id = NULL) and update (rubric_id provided)
-- Converted to function
-- Follows personas save pattern - accepts resource IDs directly
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_save_rubric_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_rubric_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_rubric_v4(
    name_id uuid,
    department_ids uuid[],
    profile_id uuid,
    input_rubric_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    total_points_id uuid DEFAULT NULL,
    pass_points_id uuid DEFAULT NULL,
    standard_group_ids uuid[] DEFAULT ARRAY[]::uuid[],
    rubric_domain_id uuid DEFAULT NULL
)
RETURNS TABLE (
    rubric_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_rubric_id uuid;
    v_actor_name text;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_rubric_id IS NULL);
    
    -- Create or UPDATE rubric_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO rubric_artifact (rubric_domain_id, created_at, updated_at)
        VALUES (rubric_domain_id, NOW(), NOW())
        RETURNING id INTO v_rubric_id;
    ELSE
        -- UPDATE path
        v_rubric_id := input_rubric_id;
        UPDATE rubric_artifact
        SET rubric_domain_id = COALESCE(rubric_domain_id, rubric.rubric_domain_id),
            updated_at = NOW()
        WHERE id = v_rubric_id;
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
    
    IF total_points_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM points_resource WHERE id = total_points_id) THEN
        RAISE EXCEPTION 'Total points resource not found: %', total_points_id;
    END IF;
    
    IF pass_points_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM points_resource WHERE id = pass_points_id) THEN
        RAISE EXCEPTION 'Pass points resource not found: %', pass_points_id;
    END IF;
    
    -- Validate standard_group_ids exist
    IF array_length(standard_group_ids, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(standard_group_ids) AS sg_id
            WHERE NOT EXISTS (SELECT 1 FROM standard_groups_resource WHERE id = sg_id)
        ) THEN
            RAISE EXCEPTION 'One or more standard_group_ids not found';
        END IF;
    END IF;
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM rubric_names WHERE rubric_id = v_rubric_id;
        DELETE FROM rubric_descriptions WHERE rubric_id = v_rubric_id;
        DELETE FROM rubric_points WHERE rubric_id = v_rubric_id;
        DELETE FROM rubric_departments WHERE rubric_id = v_rubric_id;
        -- Deactivate (don't delete) standard_group links
        UPDATE rubric_standard_groups SET active = false, updated_at = NOW()
        WHERE rubric_id = v_rubric_id AND active = true;
        -- Update existing active flag if it exists
        UPDATE rubric_flags SET
            flag_id = COALESCE(api_save_rubric_v4.active_flag_id, rubric_flags.flag_id),
            value = CASE WHEN api_save_rubric_v4.active_flag_id IS NOT NULL THEN true ELSE false END,
            updated_at = NOW()
        WHERE rubric_id = v_rubric_id
          AND type = 'active'::type_rubric_flags;
    END IF;
    
    -- Continue with rubric save using SQL (rubric already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_rubric_id AS rubric_id,
            name_id,
            description_id,
            active_flag_id,
            total_points_id,
            pass_points_id,
            COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
            COALESCE(standard_group_ids, ARRAY[]::uuid[]) AS standard_group_ids,
            profile_id,
            rubric_domain_id
    ),
    user_profile AS (
        SELECT 
            p.role,
            COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
        FROM params x
        JOIN profile_artifact p ON p.id = x.profile_id
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM rubric_departments
        WHERE rubric_departments.rubric_id = (SELECT p.rubric_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments
        WHERE profile_departments.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT 
            CASE 
                WHEN (SELECT p.rubric_id FROM params p) IS NULL THEN
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
    -- Link rubric to name
    link_rubric_name AS (
        INSERT INTO rubric_names (rubric_id, name_id, created_at, updated_at)
        SELECT 
            x.rubric_id,
            x.name_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT rubric_names_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link rubric to description
    link_rubric_description AS (
        INSERT INTO rubric_descriptions (rubric_id, description_id, created_at, updated_at)
        SELECT 
            x.rubric_id,
            x.description_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT rubric_descriptions_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Insert or UPDATE rubric_artifact active flag (UPDATE handled above for update case, INSERT here handles both via ON CONFLICT)
    insert_rubric_active_flag AS (
        INSERT INTO rubric_flags (rubric_id, flag_id, type, value, created_at, updated_at)
        SELECT 
            x.rubric_id,
            COALESCE(x.active_flag_id, f.id),
            'active'::type_rubric_flags,
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'active'
        ON CONFLICT ON CONSTRAINT rubric_flags_pkey DO UPDATE SET 
            flag_id = COALESCE(EXCLUDED.flag_id, rubric_flags.flag_id),
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Link total_points
    link_total_points AS (
        INSERT INTO rubric_points (rubric_id, point_id, type, created_at, updated_at)
        SELECT 
            x.rubric_id,
            x.total_points_id,
            'total'::type_rubric_points,
            NOW(),
            NOW()
        FROM params x
        WHERE x.total_points_id IS NOT NULL
        ON CONFLICT (rubric_id, point_id, type) DO UPDATE SET updated_at = NOW()
    ),
    -- Link pass_points
    link_pass_points AS (
        INSERT INTO rubric_points (rubric_id, point_id, type, created_at, updated_at)
        SELECT 
            x.rubric_id,
            x.pass_points_id,
            'pass'::type_rubric_points,
            NOW(),
            NOW()
        FROM params x
        WHERE x.pass_points_id IS NOT NULL
        ON CONFLICT (rubric_id, point_id, type) DO UPDATE SET updated_at = NOW()
    ),
    -- Link departments (old ones already deleted above if update)
    link_departments AS (
        INSERT INTO rubric_departments (rubric_id, department_id, active, created_at, updated_at)
        SELECT 
            x.rubric_id,
            dept_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT rubric_departments_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    -- Link standard_groups (old ones already deactivated above if update)
    -- Use position from existing links if available, otherwise use array position
    standard_groups_with_position AS (
        SELECT 
            sg_id,
            COALESCE(
                (SELECT rsg.position FROM rubric_standard_groups rsg 
                 WHERE rsg.rubric_id = (SELECT rubric_id FROM params LIMIT 1) 
                   AND rsg.standard_group_id = sg_id 
                   AND rsg.active = false
                 ORDER BY rsg.updated_at DESC LIMIT 1),
                (ROW_NUMBER() OVER (ORDER BY ordinality))::int
            ) as position
        FROM params x
        CROSS JOIN UNNEST(x.standard_group_ids) WITH ORDINALITY as sg_id
        WHERE COALESCE(array_length(x.standard_group_ids, 1), 0) > 0
    ),
    link_standard_groups AS (
        INSERT INTO rubric_standard_groups (rubric_id, standard_group_id, position, active, created_at, updated_at)
        SELECT 
            x.rubric_id,
            sgwp.sg_id,
            sgwp.position,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN standard_groups_with_position sgwp
        ON CONFLICT ON CONSTRAINT rubric_standard_groups_pkey DO UPDATE SET
            position = EXCLUDED.position,
            active = true,
            updated_at = NOW()
    )
    SELECT 
        x.rubric_id AS rubric_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
