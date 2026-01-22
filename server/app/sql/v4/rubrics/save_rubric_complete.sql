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
    draft_id uuid,
    profile_id uuid,
    input_rubric_id uuid DEFAULT NULL
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
    v_draft_id uuid;
    v_profile_id uuid;
    v_input_rubric_id uuid;
    is_create boolean;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_total_points_id uuid;
    v_pass_points_id uuid;
    v_department_ids uuid[];
    v_standard_group_ids uuid[];
    v_standard_ids uuid[];
BEGIN
    v_draft_id := draft_id;
    v_profile_id := profile_id;
    v_input_rubric_id := input_rubric_id;

    IF v_draft_id IS NULL THEN
        RAISE EXCEPTION 'draft_id is required';
    END IF;

    SELECT dn.names_id
    INTO v_name_id
    FROM names_draft dn
    WHERE dn.draft_id = v_draft_id
    LIMIT 1;

    SELECT dd.descriptions_id
    INTO v_description_id
    FROM descriptions_draft dd
    WHERE dd.draft_id = v_draft_id
    LIMIT 1;

    SELECT df.flags_id
    INTO v_active_flag_id
    FROM flags_draft df
    WHERE df.draft_id = v_draft_id
    LIMIT 1;

    SELECT dp.points_id
    INTO v_total_points_id
    FROM points_draft dp
    WHERE dp.draft_id = v_draft_id
    ORDER BY dp.created_at
    LIMIT 1;

    SELECT dp.points_id
    INTO v_pass_points_id
    FROM points_draft dp
    WHERE dp.draft_id = v_draft_id
    ORDER BY dp.created_at
    LIMIT 1;

    SELECT COALESCE(ARRAY_AGG(dd.departments_id ORDER BY dd.created_at), ARRAY[]::uuid[])
    INTO v_department_ids
    FROM departments_draft dd
    WHERE dd.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(dsg.standard_groups_id ORDER BY dsg.created_at), ARRAY[]::uuid[])
    INTO v_standard_group_ids
    FROM standard_groups_draft dsg
    WHERE dsg.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(ds.standards_id ORDER BY ds.created_at), ARRAY[]::uuid[])
    INTO v_standard_ids
    FROM standards_draft ds
    WHERE ds.draft_id = v_draft_id;

    -- Determine if create or update
    is_create := (v_input_rubric_id IS NULL);
    
    -- Create or UPDATE rubric_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO rubric_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_rubric_id;
    ELSE
        -- UPDATE path
        v_rubric_id := v_input_rubric_id;
        UPDATE rubric_artifact
        SET updated_at = NOW()
        WHERE id = v_rubric_id;
    END IF;
    
    -- Validate required resource IDs exist (same for both)
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;
    
    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;
    
    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;
    
    IF v_total_points_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM points_resource WHERE id = v_total_points_id) THEN
        RAISE EXCEPTION 'Total points resource not found: %', v_total_points_id;
    END IF;
    
    IF v_pass_points_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM points_resource WHERE id = v_pass_points_id) THEN
        RAISE EXCEPTION 'Pass points resource not found: %', v_pass_points_id;
    END IF;
    
    -- Validate standard_group_ids exist
    IF array_length(v_standard_group_ids, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_standard_group_ids) AS sg_id
            WHERE NOT EXISTS (SELECT 1 FROM standard_groups_resource WHERE id = sg_id)
        ) THEN
            RAISE EXCEPTION 'One or more standard_group_ids not found';
        END IF;
    END IF;

    IF array_length(v_standard_ids, 1) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_standard_ids) AS std_id
            WHERE NOT EXISTS (SELECT 1 FROM standards_resource WHERE id = std_id)
        ) THEN
            RAISE EXCEPTION 'One or more standard_ids not found';
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
        -- Deactivate (don't delete) standard links
        UPDATE rubric_standards SET active = false, updated_at = NOW()
        WHERE rubric_id = v_rubric_id AND active = true;
        -- Update existing active flag if it exists
        UPDATE rubric_flags SET
            flag_id = COALESCE(v_active_flag_id, rubric_flags.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END,
            updated_at = NOW()
        WHERE rubric_id = v_rubric_id
          ;
    END IF;
    
    -- Continue with rubric save using SQL (rubric already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_rubric_id AS rubric_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_active_flag_id AS active_flag_id,
            v_total_points_id AS total_points_id,
            v_pass_points_id AS pass_points_id,
            COALESCE(v_department_ids, ARRAY[]::uuid[]) AS department_ids,
            COALESCE(v_standard_group_ids, ARRAY[]::uuid[]) AS standard_group_ids,
            COALESCE(v_standard_ids, ARRAY[]::uuid[]) AS standard_ids,
            v_profile_id AS profile_id
    ),
    user_profile AS (
        SELECT 
            (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) as role,
            COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
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
        INSERT INTO rubric_flags (rubric_id, flag_id, value, created_at, updated_at) SELECT x.rubric_id,
            COALESCE(x.active_flag_id, f.id),
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'rubric_active'
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
            'total'::point_type,
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
            'pass'::point_type,
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
    ),
    -- Link standards (old ones already deactivated above if update)
    link_standards AS (
        INSERT INTO rubric_standards (rubric_id, standard_id, active, created_at, updated_at)
        SELECT 
            x.rubric_id,
            std_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.standard_ids) as std_id
        WHERE COALESCE(array_length(x.standard_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT rubric_standards_pkey DO UPDATE SET
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
