-- Patch persona draft - accepts resource IDs and creates/updates draft
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
        WHERE proname = 'api_patch_persona_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_persona_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_persona_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    color_id uuid DEFAULT NULL,
    icon_id uuid DEFAULT NULL,
    instructions_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    field_ids uuid[] DEFAULT NULL,
    example_ids uuid[] DEFAULT NULL,
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
    
    IF color_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM colors_resource WHERE id = color_id) THEN
        RAISE EXCEPTION 'Color resource not found: %', color_id;
    END IF;
    
    IF icon_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM icons_resource WHERE id = icon_id) THEN
        RAISE EXCEPTION 'Icon resource not found: %', icon_id;
    END IF;
    
    IF instructions_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM instructions_resource WHERE id = instructions_id) THEN
        RAISE EXCEPTION 'Instructions resource not found: %', instructions_id;
    END IF;
    
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;

    IF department_ids IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(department_ids) as dept_id
            WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = dept_id)
        ) THEN
            RAISE EXCEPTION 'One or more department resource IDs not found in departments_resource';
        END IF;
    END IF;

    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        -- Get existing draft's group_id
        SELECT group_id INTO v_group_id FROM resource_drafts WHERE id = input_draft_id;
        
        -- Create group if draft doesn't have one (shouldn't happen after migration, but safety check)
        IF v_group_id IS NULL THEN
            INSERT INTO groups (created_at, updated_at)
            VALUES (NOW(), NOW())
            RETURNING id INTO v_group_id;
        END IF;
        
        UPDATE resource_drafts
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
            DELETE FROM names_draft WHERE names_draft.draft_id = v_draft_id;
            DELETE FROM descriptions_draft WHERE descriptions_draft.draft_id = v_draft_id;
            DELETE FROM colors_draft WHERE colors_draft.draft_id = v_draft_id;
            DELETE FROM icons_draft WHERE icons_draft.draft_id = v_draft_id;
            DELETE FROM instructions_draft WHERE instructions_draft.draft_id = v_draft_id;
            DELETE FROM flags_draft WHERE flags_draft.draft_id = v_draft_id;
            DELETE FROM departments_draft WHERE departments_draft.draft_id = v_draft_id;
            DELETE FROM fields_draft WHERE fields_draft.draft_id = v_draft_id;
            DELETE FROM examples_draft WHERE examples_draft.draft_id = v_draft_id;
            
            -- Insert new resource links
            IF name_id IS NOT NULL THEN
                INSERT INTO names_draft (draft_id, names_id, version)
                VALUES (v_draft_id, name_id, v_new_version)
                ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF description_id IS NOT NULL THEN
                INSERT INTO descriptions_draft (draft_id, descriptions_id, version)
                VALUES (v_draft_id, description_id, v_new_version)
                ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF color_id IS NOT NULL THEN
                INSERT INTO colors_draft (draft_id, colors_id, version)
                VALUES (v_draft_id, color_id, v_new_version)
                ON CONFLICT ON CONSTRAINT colors_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF icon_id IS NOT NULL THEN
                INSERT INTO icons_draft (draft_id, icons_id, version)
                VALUES (v_draft_id, icon_id, v_new_version)
                ON CONFLICT ON CONSTRAINT icons_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF instructions_id IS NOT NULL THEN
                INSERT INTO instructions_draft (draft_id, instructions_id, version)
                VALUES (v_draft_id, instructions_id, v_new_version)
                ON CONFLICT ON CONSTRAINT instructions_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF active_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, active_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            -- Handle array resources (departments, fields, examples)
            IF department_ids IS NOT NULL THEN
                DELETE FROM departments_draft WHERE departments_draft.draft_id = v_draft_id;
                INSERT INTO departments_draft (draft_id, departments_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM UNNEST(department_ids) as dept_id
                ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF field_ids IS NOT NULL THEN
                DELETE FROM fields_draft WHERE fields_draft.draft_id = v_draft_id;
                INSERT INTO fields_draft (draft_id, fields_id, version)
                SELECT v_draft_id, field_id, v_new_version
                FROM UNNEST(field_ids) as field_id
                ON CONFLICT ON CONSTRAINT fields_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF example_ids IS NOT NULL THEN
                DELETE FROM examples_draft WHERE examples_draft.draft_id = v_draft_id;
                INSERT INTO examples_draft (draft_id, examples_id, version)
                SELECT v_draft_id, ex_id, v_new_version
                FROM UNNEST(example_ids) as ex_id
                ON CONFLICT ON CONSTRAINT examples_draft_pkey DO UPDATE
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
    INSERT INTO resource_drafts (artifact, profile_id, group_id)
    VALUES ('persona'::artifacts, v_profile_id, v_group_id)
    RETURNING id, version INTO v_draft_id, v_new_version;
    
    -- Link resources to draft
    IF name_id IS NOT NULL THEN
        INSERT INTO names_draft (draft_id, names_id, version)
        VALUES (v_draft_id, name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF description_id IS NOT NULL THEN
        INSERT INTO descriptions_draft (draft_id, descriptions_id, version)
        VALUES (v_draft_id, description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF color_id IS NOT NULL THEN
        INSERT INTO colors_draft (draft_id, colors_id, version)
        VALUES (v_draft_id, color_id, v_new_version)
        ON CONFLICT ON CONSTRAINT colors_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF icon_id IS NOT NULL THEN
        INSERT INTO icons_draft (draft_id, icons_id, version)
        VALUES (v_draft_id, icon_id, v_new_version)
        ON CONFLICT ON CONSTRAINT icons_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF instructions_id IS NOT NULL THEN
        INSERT INTO instructions_draft (draft_id, instructions_id, version)
        VALUES (v_draft_id, instructions_id, v_new_version)
        ON CONFLICT ON CONSTRAINT instructions_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF active_flag_id IS NOT NULL THEN
        INSERT INTO flags_draft (draft_id, flags_id, version)
        VALUES (v_draft_id, active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    -- Handle array resources
    IF department_ids IS NOT NULL THEN
        INSERT INTO departments_draft (draft_id, departments_id, version)
        SELECT v_draft_id, dept_id, v_new_version
        FROM UNNEST(department_ids) as dept_id
        ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF field_ids IS NOT NULL THEN
        INSERT INTO fields_draft (draft_id, fields_id, version)
        SELECT v_draft_id, field_id, v_new_version
        FROM UNNEST(field_ids) as field_id
        ON CONFLICT ON CONSTRAINT fields_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF example_ids IS NOT NULL THEN
        INSERT INTO examples_draft (draft_id, examples_id, version)
        SELECT v_draft_id, ex_id, v_new_version
        FROM UNNEST(example_ids) as ex_id
        ON CONFLICT ON CONSTRAINT examples_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;
