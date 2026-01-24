-- Patch setting draft - accepts resource IDs and creates/updates draft
-- Creates draft if input_draft_id is NULL, updates if exists
-- Links resources via junction tables

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_patch_setting_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_setting_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_setting_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    color_ids uuid[] DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    profile_ids uuid[] DEFAULT NULL,
    auth_ids uuid[] DEFAULT NULL,
    provider_ids uuid[] DEFAULT NULL,
    key_ids uuid[] DEFAULT NULL,
    role_ids uuid[] DEFAULT NULL,
    route_ids uuid[] DEFAULT NULL,
    role_route_ids uuid[] DEFAULT NULL,
    expected_version int DEFAULT 0
)
RETURNS TABLE (
    draft_id uuid,
    new_version int,
    draft_exists boolean
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_draft_id uuid;
    v_new_version int;
    v_draft_exists boolean := false;
    v_profile_id uuid := profile_id;
    v_group_id uuid;
BEGIN
    -- Validate resource IDs exist (error if missing and provided)
    IF name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;
    
    IF description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;
    
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;

    IF profile_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM UNNEST(profile_ids) as pid
        WHERE NOT EXISTS (SELECT 1 FROM profile_artifact WHERE id = pid)
    ) THEN
        RAISE EXCEPTION 'Profile resource not found in profile_artifact';
    END IF;
    
    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        -- Get existing draft's group_id
        SELECT group_id INTO v_group_id FROM drafts_entry WHERE id = input_draft_id;
        
        -- Create group if draft doesn't have one (shouldn't happen after migration, but safety check)
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (NOW(), NOW(), (SELECT id FROM sessions_entry WHERE profile_id = profile_id AND active = true ORDER BY created_at DESC LIMIT 1))
            RETURNING id INTO v_group_id;
        END IF;
        
        UPDATE drafts_entry
        SET version = drafts_entry.version + 1,
            updated_at = now(),
            group_id = COALESCE(drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND drafts_entry.profile_id = v_profile_id
          AND drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;
        
        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
            
            -- Delete old resource links
            DELETE FROM names_draft WHERE names_draft.draft_id = v_draft_id;
            DELETE FROM descriptions_draft WHERE descriptions_draft.draft_id = v_draft_id;
            DELETE FROM colors_draft WHERE colors_draft.draft_id = v_draft_id;
            DELETE FROM flags_draft WHERE flags_draft.draft_id = v_draft_id;
            DELETE FROM departments_draft WHERE departments_draft.draft_id = v_draft_id;
            DELETE FROM profiles_draft WHERE profiles_draft.draft_id = v_draft_id;
            DELETE FROM providers_draft WHERE providers_draft.draft_id = v_draft_id;
            DELETE FROM keys_draft WHERE keys_draft.draft_id = v_draft_id;
            
            -- Insert new resource links
            IF name_id IS NOT NULL THEN
                INSERT INTO names_draft (draft_id, names_id, version)
                VALUES (v_draft_id, name_id, v_new_version)
                ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
            
            IF description_id IS NOT NULL THEN
                INSERT INTO descriptions_draft (draft_id, descriptions_id, version)
                VALUES (v_draft_id, description_id, v_new_version)
                ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
            
            IF active_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, active_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
            
            -- Handle array resources (colors, departments, auths, providers, keys)
            IF color_ids IS NOT NULL THEN
                DELETE FROM colors_draft WHERE colors_draft.draft_id = v_draft_id;
                INSERT INTO colors_draft (draft_id, colors_id, version)
                SELECT v_draft_id, color_id, v_new_version
                FROM UNNEST(color_ids) as color_id
                ON CONFLICT ON CONSTRAINT colors_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
            
            IF department_ids IS NOT NULL THEN
                DELETE FROM departments_draft WHERE departments_draft.draft_id = v_draft_id;
                INSERT INTO departments_draft (draft_id, departments_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM UNNEST(department_ids) as dept_id
                ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF profile_ids IS NOT NULL THEN
                DELETE FROM profiles_draft WHERE profiles_draft.draft_id = v_draft_id;
                INSERT INTO profiles_draft (draft_id, profiles_id, version)
                SELECT v_draft_id, profile_id, v_new_version
                FROM UNNEST(profile_ids) as profile_id
                ON CONFLICT ON CONSTRAINT profiles_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
            
            IF provider_ids IS NOT NULL THEN
                DELETE FROM providers_draft WHERE providers_draft.draft_id = v_draft_id;
                INSERT INTO providers_draft (draft_id, providers_id, version)
                SELECT v_draft_id, provider_id, v_new_version
                FROM UNNEST(provider_ids) as provider_id
                ON CONFLICT ON CONSTRAINT providers_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
            
            IF key_ids IS NOT NULL THEN
                DELETE FROM keys_draft WHERE keys_draft.draft_id = v_draft_id;
                INSERT INTO keys_draft (draft_id, keys_id, version)
                SELECT v_draft_id, key_id, v_new_version
                FROM UNNEST(key_ids) as key_id
                ON CONFLICT ON CONSTRAINT keys_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF role_ids IS NOT NULL THEN
                DELETE FROM roles_draft WHERE roles_draft.draft_id = v_draft_id;
                INSERT INTO roles_draft (draft_id, roles_id, version)
                SELECT v_draft_id, role_id, v_new_version
                FROM UNNEST(role_ids) as role_id
                ON CONFLICT ON CONSTRAINT roles_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF route_ids IS NOT NULL THEN
                DELETE FROM routes_draft WHERE routes_draft.draft_id = v_draft_id;
                INSERT INTO routes_draft (draft_id, routes_id, version)
                SELECT v_draft_id, route_id, v_new_version
                FROM UNNEST(route_ids) as route_id
                ON CONFLICT ON CONSTRAINT routes_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF role_route_ids IS NOT NULL THEN
                DELETE FROM role_routes_draft WHERE role_routes_draft.draft_id = v_draft_id;
                INSERT INTO role_routes_draft (draft_id, role_routes_id, version)
                SELECT v_draft_id, rr_id, v_new_version
                FROM UNNEST(role_route_ids) as rr_id
                ON CONFLICT ON CONSTRAINT role_routes_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
            RETURN;
        END IF;
    END IF;
    
    -- Create new draft with group
    -- First create a group for this draft
    INSERT INTO groups_entry (created_at, updated_at, session_id)
    VALUES (NOW(), NOW(), (SELECT id FROM sessions_entry WHERE profile_id = profile_id AND active = true ORDER BY created_at DESC LIMIT 1))
    RETURNING id INTO v_group_id;
    
    -- Create new draft with group_id
    INSERT INTO drafts_entry (artifact, profile_id, group_id)
    VALUES ('setting'::artifact_type, v_profile_id, v_group_id)
    RETURNING id, version INTO v_draft_id, v_new_version;
    
    -- Link resources to draft
    IF name_id IS NOT NULL THEN
        INSERT INTO names_draft (draft_id, names_id, version)
        VALUES (v_draft_id, name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;
    
    IF description_id IS NOT NULL THEN
        INSERT INTO descriptions_draft (draft_id, descriptions_id, version)
        VALUES (v_draft_id, description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;
    
    IF active_flag_id IS NOT NULL THEN
        INSERT INTO flags_draft (draft_id, flags_id, version)
        VALUES (v_draft_id, active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;
    
    -- Handle array resources
    IF color_ids IS NOT NULL THEN
        INSERT INTO colors_draft (draft_id, colors_id, version)
        SELECT v_draft_id, color_id, v_new_version
        FROM UNNEST(color_ids) as color_id
        ON CONFLICT ON CONSTRAINT colors_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;
    
    IF department_ids IS NOT NULL THEN
        INSERT INTO departments_draft (draft_id, departments_id, version)
        SELECT v_draft_id, dept_id, v_new_version
        FROM UNNEST(department_ids) as dept_id
        ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF profile_ids IS NOT NULL THEN
        INSERT INTO profiles_draft (draft_id, profiles_id, version)
        SELECT v_draft_id, profile_id, v_new_version
        FROM UNNEST(profile_ids) as profile_id
        ON CONFLICT ON CONSTRAINT profiles_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;
    
    IF provider_ids IS NOT NULL THEN
        INSERT INTO providers_draft (draft_id, providers_id, version)
        SELECT v_draft_id, provider_id, v_new_version
        FROM UNNEST(provider_ids) as provider_id
        ON CONFLICT ON CONSTRAINT providers_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;
    
    IF key_ids IS NOT NULL THEN
        INSERT INTO keys_draft (draft_id, keys_id, version)
        SELECT v_draft_id, key_id, v_new_version
        FROM UNNEST(key_ids) as key_id
        ON CONFLICT ON CONSTRAINT keys_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF role_ids IS NOT NULL THEN
        INSERT INTO roles_draft (draft_id, roles_id, version)
        SELECT v_draft_id, role_id, v_new_version
        FROM UNNEST(role_ids) as role_id
        ON CONFLICT ON CONSTRAINT roles_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF route_ids IS NOT NULL THEN
        INSERT INTO routes_draft (draft_id, routes_id, version)
        SELECT v_draft_id, route_id, v_new_version
        FROM UNNEST(route_ids) as route_id
        ON CONFLICT ON CONSTRAINT routes_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF role_route_ids IS NOT NULL THEN
        INSERT INTO role_routes_draft (draft_id, role_routes_id, version)
        SELECT v_draft_id, rr_id, v_new_version
        FROM UNNEST(role_route_ids) as rr_id
        ON CONFLICT ON CONSTRAINT role_routes_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;
