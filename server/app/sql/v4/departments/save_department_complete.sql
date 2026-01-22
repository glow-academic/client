-- Unified save department function - handles both create (department_id = NULL) and update (department_id provided)
-- Converted to function following personas pattern
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_save_department_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_department_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_department_v4(
    draft_id uuid,
    profile_id uuid,
    input_department_id uuid DEFAULT NULL
)
RETURNS TABLE (
    department_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_department_id uuid;
    v_actor_name text;
    v_group_id uuid;
    v_draft_id uuid;
    v_profile_id uuid;
    v_input_department_id uuid;
    is_create boolean;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_settings_id uuid;
BEGIN
    v_draft_id := draft_id;
    v_profile_id := profile_id;
    v_input_department_id := input_department_id;

    IF v_draft_id IS NULL THEN
        RAISE EXCEPTION 'Draft ID is required';
    END IF;

    SELECT d.group_id INTO v_group_id
    FROM resource_drafts d
    WHERE d.id = v_draft_id;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Draft group_id not found: %', v_draft_id;
    END IF;

    SELECT dn.names_id INTO v_name_id
    FROM names_draft dn
    WHERE dn.draft_id = v_draft_id
    LIMIT 1;

    SELECT dd.descriptions_id INTO v_description_id
    FROM descriptions_draft dd
    WHERE dd.draft_id = v_draft_id
    LIMIT 1;

    SELECT df.flags_id INTO v_active_flag_id
    FROM flags_draft df
    WHERE df.draft_id = v_draft_id
    LIMIT 1;

    SELECT ds.settings_id INTO v_settings_id
    FROM settings_draft ds
    WHERE ds.draft_id = v_draft_id
    LIMIT 1;

    -- Determine if create or update
    is_create := (v_input_department_id IS NULL);
    
    -- Create or UPDATE department_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path: Create group first, then department
        INSERT INTO department_artifact (group_id, created_at, updated_at)
        VALUES (v_group_id, NOW(), NOW())
        RETURNING id INTO v_department_id;
    ELSE
        -- UPDATE path
        v_department_id := v_input_department_id;
        UPDATE department_artifact
        SET updated_at = NOW()
        WHERE id = v_department_id;
    END IF;
    
    -- Validate required resource IDs exist (same for both)
    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;
    
    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;
    
    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM department_names WHERE department_id = v_department_id;
        DELETE FROM department_descriptions WHERE department_id = v_department_id;
        -- Update existing active flag if it exists
        UPDATE department_flags SET
            flag_id = COALESCE(v_active_flag_id, department_flags.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END,
            updated_at = NOW()
        WHERE department_id = v_department_id
          ;
    END IF;
    
    -- Continue with department save using SQL (department already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_department_id AS department_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_active_flag_id AS active_flag_id,
            COALESCE(v_settings_id, NULL::uuid) AS settings_id,
            v_profile_id AS profile_id
    ),
    user_profile AS (
        SELECT 
            (SELECT r.role FROM profile_roles pr_j 
             JOIN roles_resource r ON pr_j.role_id = r.id 
             WHERE pr_j.profile_id = p.id 
             LIMIT 1) as role,
            COALESCE(
                (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1) || ' ' || 
                (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id LIMIT 1), 
                'System'
            ) as actor_name
        FROM params x
        JOIN profile_artifact p ON p.id = x.profile_id
    ),
    actor_profile AS (
        SELECT 
            x.profile_id,
            up.actor_name
        FROM params x
        CROSS JOIN user_profile up
    ),
    -- Link department to name
    link_department_name AS (
        INSERT INTO department_names (department_id, name_id, created_at, updated_at)
        SELECT 
            x.department_id,
            x.name_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT department_names_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link department to description
    link_department_description AS (
        INSERT INTO department_descriptions (department_id, description_id, created_at, updated_at)
        SELECT 
            x.department_id,
            x.description_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT department_descriptions_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Insert or UPDATE department_artifact active flag (UPDATE handled above for update case, INSERT here handles both via ON CONFLICT)
    insert_department_active_flag AS (
        INSERT INTO department_flags (department_id, flag_id, value, created_at, updated_at) SELECT x.department_id,
            COALESCE(x.active_flag_id, f.id),
            'active'::type_department_flags,
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'department_active'
        ON CONFLICT ON CONSTRAINT department_flags_pkey DO UPDATE SET 
            flag_id = COALESCE(EXCLUDED.flag_id, department_flags.flag_id),
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Remove existing settings link if settings_id is null or different (for update case)
    remove_existing_settings AS (
        DELETE FROM department_settings ds
        WHERE ds.department_id = (SELECT x.department_id FROM params x)
          AND (
              (SELECT x2.settings_id FROM params x2) IS NULL 
              OR ds.settings_id != (SELECT x3.settings_id FROM params x3)
          )
    ),
    -- Link settings if provided
    link_settings AS (
        INSERT INTO department_settings (settings_id, department_id, active, created_at, updated_at)
        SELECT 
            x.settings_id,
            x.department_id,
            true,
            NOW(),
            NOW()
        FROM params x
        WHERE x.settings_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT department_settings_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    )
    SELECT 
        x.department_id,
        ap.actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
