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
    auth_ids uuid[] DEFAULT NULL,
    provider_ids uuid[] DEFAULT NULL,
    key_ids uuid[] DEFAULT NULL,
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
    IF name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;
    
    IF description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions WHERE id = description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;
    
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;
    
    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        -- Get existing draft's group_id
        SELECT group_id INTO v_group_id FROM drafts WHERE id = input_draft_id;
        
        -- Create group if draft doesn't have one (shouldn't happen after migration, but safety check)
        IF v_group_id IS NULL THEN
            INSERT INTO groups (created_at, updated_at)
            VALUES (NOW(), NOW())
            RETURNING id INTO v_group_id;
        END IF;
        
        UPDATE drafts
        SET version = drafts.version + 1,
            updated_at = now(),
            group_id = COALESCE(group_id, v_group_id)
        WHERE id = input_draft_id
          AND drafts.profile_id = v_profile_id
          AND drafts.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;
        
        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
            
            -- Delete old resource links
            DELETE FROM draft_names WHERE draft_names.draft_id = v_draft_id;
            DELETE FROM draft_descriptions WHERE draft_descriptions.draft_id = v_draft_id;
            DELETE FROM draft_colors WHERE draft_colors.draft_id = v_draft_id;
            DELETE FROM draft_flags WHERE draft_flags.draft_id = v_draft_id;
            DELETE FROM draft_departments WHERE draft_departments.draft_id = v_draft_id;
            DELETE FROM draft_auth WHERE draft_auth.draft_id = v_draft_id;
            DELETE FROM draft_providers WHERE draft_providers.draft_id = v_draft_id;
            DELETE FROM draft_keys WHERE draft_keys.draft_id = v_draft_id;
            
            -- Insert new resource links
            IF name_id IS NOT NULL THEN
                INSERT INTO draft_names (draft_id, names_id, version)
                VALUES (v_draft_id, name_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_names_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF description_id IS NOT NULL THEN
                INSERT INTO draft_descriptions (draft_id, descriptions_id, version)
                VALUES (v_draft_id, description_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_descriptions_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF active_flag_id IS NOT NULL THEN
                INSERT INTO draft_flags (draft_id, flags_id, version)
                VALUES (v_draft_id, active_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            -- Handle array resources (colors, departments, auths, providers, keys)
            IF color_ids IS NOT NULL THEN
                DELETE FROM draft_colors WHERE draft_colors.draft_id = v_draft_id;
                INSERT INTO draft_colors (draft_id, colors_id, version)
                SELECT v_draft_id, color_id, v_new_version
                FROM UNNEST(color_ids) as color_id
                ON CONFLICT ON CONSTRAINT draft_colors_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF department_ids IS NOT NULL THEN
                DELETE FROM draft_departments WHERE draft_departments.draft_id = v_draft_id;
                INSERT INTO draft_departments (draft_id, departments_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM UNNEST(department_ids) as dept_id
                ON CONFLICT ON CONSTRAINT draft_departments_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF auth_ids IS NOT NULL THEN
                DELETE FROM draft_auth WHERE draft_auth.draft_id = v_draft_id;
                INSERT INTO draft_auth (draft_id, auth_id, version)
                SELECT v_draft_id, auth_id, v_new_version
                FROM UNNEST(auth_ids) as auth_id
                ON CONFLICT ON CONSTRAINT draft_auth_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF provider_ids IS NOT NULL THEN
                DELETE FROM draft_providers WHERE draft_providers.draft_id = v_draft_id;
                INSERT INTO draft_providers (draft_id, providers_id, version)
                SELECT v_draft_id, provider_id, v_new_version
                FROM UNNEST(provider_ids) as provider_id
                ON CONFLICT ON CONSTRAINT draft_providers_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF key_ids IS NOT NULL THEN
                DELETE FROM draft_keys WHERE draft_keys.draft_id = v_draft_id;
                INSERT INTO draft_keys (draft_id, keys_id, version)
                SELECT v_draft_id, key_id, v_new_version
                FROM UNNEST(key_ids) as key_id
                ON CONFLICT ON CONSTRAINT draft_keys_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
            RETURN;
        END IF;
    END IF;
    
    -- Create new draft with group
    -- First create a group for this draft
    INSERT INTO groups (created_at, updated_at)
    VALUES (NOW(), NOW())
    RETURNING id INTO v_group_id;
    
    -- Create new draft with group_id
    INSERT INTO drafts (artifact, profile_id, group_id)
    VALUES ('setting'::artifacts, v_profile_id, v_group_id)
    RETURNING id, version INTO v_draft_id, v_new_version;
    
    -- Link resources to draft
    IF name_id IS NOT NULL THEN
        INSERT INTO draft_names (draft_id, names_id, version)
        VALUES (v_draft_id, name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_names_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF description_id IS NOT NULL THEN
        INSERT INTO draft_descriptions (draft_id, descriptions_id, version)
        VALUES (v_draft_id, description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_descriptions_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF active_flag_id IS NOT NULL THEN
        INSERT INTO draft_flags (draft_id, flags_id, version)
        VALUES (v_draft_id, active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    -- Handle array resources
    IF color_ids IS NOT NULL THEN
        INSERT INTO draft_colors (draft_id, colors_id, version)
        SELECT v_draft_id, color_id, v_new_version
        FROM UNNEST(color_ids) as color_id
        ON CONFLICT ON CONSTRAINT draft_colors_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF department_ids IS NOT NULL THEN
        INSERT INTO draft_departments (draft_id, departments_id, version)
        SELECT v_draft_id, dept_id, v_new_version
        FROM UNNEST(department_ids) as dept_id
        ON CONFLICT ON CONSTRAINT draft_departments_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF auth_ids IS NOT NULL THEN
        INSERT INTO draft_auth (draft_id, auth_id, version)
        SELECT v_draft_id, auth_id, v_new_version
        FROM UNNEST(auth_ids) as auth_id
        ON CONFLICT ON CONSTRAINT draft_auth_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF provider_ids IS NOT NULL THEN
        INSERT INTO draft_providers (draft_id, providers_id, version)
        SELECT v_draft_id, provider_id, v_new_version
        FROM UNNEST(provider_ids) as provider_id
        ON CONFLICT ON CONSTRAINT draft_providers_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF key_ids IS NOT NULL THEN
        INSERT INTO draft_keys (draft_id, keys_id, version)
        SELECT v_draft_id, key_id, v_new_version
        FROM UNNEST(key_ids) as key_id
        ON CONFLICT ON CONSTRAINT draft_keys_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;
