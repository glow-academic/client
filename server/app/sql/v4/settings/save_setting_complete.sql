-- Unified save setting function - handles both create (setting_id = NULL) and update (setting_id provided)
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
        WHERE proname = 'api_save_setting_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_setting_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_setting_v4(
    name_id uuid,
    color_ids uuid[],
    department_ids uuid[],
    profile_id uuid,
    auth_ids uuid[],
    provider_ids uuid[],
    key_ids uuid[],
    input_setting_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL
)
RETURNS TABLE (
    setting_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_setting_id uuid;
    v_actor_name text;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_setting_id IS NULL);
    
    -- Create or UPDATE setting_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO setting_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_setting_id;
    ELSE
        -- UPDATE path
        v_setting_id := input_setting_id;
        UPDATE setting_artifact
        SET updated_at = NOW()
        WHERE id = v_setting_id;
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
        DELETE FROM setting_names WHERE setting_id = v_setting_id;
        DELETE FROM setting_descriptions WHERE setting_id = v_setting_id;
        DELETE FROM setting_colors WHERE setting_id = v_setting_id;
        DELETE FROM department_settings WHERE settings_id = v_setting_id;
        DELETE FROM setting_auths WHERE settings_id = v_setting_id;
        DELETE FROM setting_providers WHERE settings_id = v_setting_id;
        -- Update existing active flag if it exists
        UPDATE setting_flags SET
            flag_id = COALESCE(api_save_setting_v4.active_flag_id, setting_flags.flag_id),
            value = CASE WHEN api_save_setting_v4.active_flag_id IS NOT NULL THEN true ELSE false END,
            updated_at = NOW()
        WHERE setting_id = v_setting_id
          ;
    END IF;
    
    -- Continue with setting save using SQL (setting already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_setting_id AS setting_id,
            name_id,
            description_id,
            active_flag_id,
            COALESCE(color_ids, ARRAY[]::uuid[]) AS color_ids,
            COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
            profile_id,
            COALESCE(auth_ids, ARRAY[]::uuid[]) AS auth_ids,
            COALESCE(provider_ids, ARRAY[]::uuid[]) AS provider_ids,
            COALESCE(key_ids, ARRAY[]::uuid[]) AS key_ids
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
        FROM department_settings
        WHERE department_settings.settings_id = (SELECT p.setting_id FROM params p LIMIT 1) AND active = true
    ),
    user_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM profile_departments
        WHERE profile_departments.profile_id = (SELECT p.profile_id FROM params p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT 
            CASE 
                WHEN (SELECT p.setting_id FROM params p) IS NULL THEN
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
    -- Link setting to name
    link_setting_name AS (
        INSERT INTO setting_names (setting_id, name_id, created_at, updated_at)
        SELECT 
            x.setting_id,
            x.name_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT setting_names_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link setting to description
    link_setting_description AS (
        INSERT INTO setting_descriptions (setting_id, description_id, created_at, updated_at)
        SELECT 
            x.setting_id,
            x.description_id,
            NOW(),
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT setting_descriptions_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Link colors (multi-select, old ones already deleted above if update)
    link_colors AS (
        INSERT INTO setting_colors (setting_id, color_id, type, created_at, updated_at)
        SELECT 
            x.setting_id,
            color_id,
            'primary'::type_setting_colors,  -- Default to primary, can be extended later
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.color_ids) as color_id
        WHERE COALESCE(array_length(x.color_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT setting_colors_pkey DO UPDATE SET updated_at = NOW()
    ),
    -- Insert or UPDATE setting_artifact active flag (UPDATE handled above for update case, INSERT here handles both via ON CONFLICT)
    insert_setting_active_flag AS (
        INSERT INTO setting_flags (setting_id, flag_id, value, created_at, updated_at) SELECT x.setting_id,
            COALESCE(x.active_flag_id, f.id),
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'active'
        ON CONFLICT ON CONSTRAINT setting_flags_pkey DO UPDATE SET 
            flag_id = COALESCE(EXCLUDED.flag_id, setting_flags.flag_id),
            value = EXCLUDED.value,
            updated_at = NOW()
    ),
    -- Link departments (old ones already deleted above if update)
    -- Use department_settings table (reverse direction: settings_id -> department_id)
    link_departments AS (
        INSERT INTO department_settings (settings_id, department_id, active, created_at, updated_at)
        SELECT 
            x.setting_id,
            dept_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT department_settings_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    -- Link auths (old ones already deleted above if update)
    link_auths AS (
        INSERT INTO setting_auths (settings_id, auth_id, active, created_at, updated_at)
        SELECT 
            x.setting_id,
            auth_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.auth_ids) as auth_id
        WHERE COALESCE(array_length(x.auth_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT setting_auths_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    -- Link providers (old ones already deleted above if update)
    link_providers AS (
        INSERT INTO setting_providers (settings_id, providers_id, active, created_at, updated_at)
        SELECT 
            x.setting_id,
            provider_id,
            true,
            NOW(),
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.provider_ids) as provider_id
        WHERE COALESCE(array_length(x.provider_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT setting_providers_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    )
    -- Note: Keys are handled separately via setting_provider_keys (ternary relationship with providers)
    -- Keys require both setting_id and providers_id, so they're managed in a separate endpoint
    SELECT 
        x.setting_id AS setting_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN actor_profile ap;
END;
$$;
