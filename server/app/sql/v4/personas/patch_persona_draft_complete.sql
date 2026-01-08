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
BEGIN
    -- Validate resource IDs exist (error if missing and provided)
    IF name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;
    
    IF description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions WHERE id = description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;
    
    IF color_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM colors WHERE id = color_id) THEN
        RAISE EXCEPTION 'Color resource not found: %', color_id;
    END IF;
    
    IF icon_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM icons WHERE id = icon_id) THEN
        RAISE EXCEPTION 'Icon resource not found: %', icon_id;
    END IF;
    
    IF instructions_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM instructions WHERE id = instructions_id) THEN
        RAISE EXCEPTION 'Instructions resource not found: %', instructions_id;
    END IF;
    
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;
    
    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        UPDATE drafts
        SET version = version + 1,
            updated_at = now()
        WHERE id = input_draft_id
          AND profile_id = profile_id
          AND version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;
        
        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
            
            -- Delete old resource links
            DELETE FROM draft_names WHERE draft_id = v_draft_id;
            DELETE FROM draft_descriptions WHERE draft_id = v_draft_id;
            DELETE FROM draft_colors WHERE draft_id = v_draft_id;
            DELETE FROM draft_icons WHERE draft_id = v_draft_id;
            DELETE FROM draft_instructions WHERE draft_id = v_draft_id;
            DELETE FROM draft_flags WHERE draft_id = v_draft_id;
            DELETE FROM draft_departments WHERE draft_id = v_draft_id;
            DELETE FROM draft_fields WHERE draft_id = v_draft_id;
            DELETE FROM draft_examples WHERE draft_id = v_draft_id;
            
            -- Insert new resource links
            IF name_id IS NOT NULL THEN
                INSERT INTO draft_names (draft_id, name_id, version)
                VALUES (v_draft_id, name_id, v_new_version)
                ON CONFLICT (draft_id, name_id) DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF description_id IS NOT NULL THEN
                INSERT INTO draft_descriptions (draft_id, description_id, version)
                VALUES (v_draft_id, description_id, v_new_version)
                ON CONFLICT (draft_id, description_id) DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF color_id IS NOT NULL THEN
                INSERT INTO draft_colors (draft_id, color_id, version)
                VALUES (v_draft_id, color_id, v_new_version)
                ON CONFLICT (draft_id, color_id) DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF icon_id IS NOT NULL THEN
                INSERT INTO draft_icons (draft_id, icon_id, version)
                VALUES (v_draft_id, icon_id, v_new_version)
                ON CONFLICT (draft_id, icon_id) DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF instructions_id IS NOT NULL THEN
                INSERT INTO draft_instructions (draft_id, instruction_id, version)
                VALUES (v_draft_id, instructions_id, v_new_version)
                ON CONFLICT (draft_id, instruction_id) DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF active_flag_id IS NOT NULL THEN
                INSERT INTO draft_flags (draft_id, flag_id, version)
                VALUES (v_draft_id, active_flag_id, v_new_version)
                ON CONFLICT (draft_id, flag_id) DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            -- Handle array resources (departments, fields, examples)
            IF department_ids IS NOT NULL THEN
                DELETE FROM draft_departments WHERE draft_id = v_draft_id;
                INSERT INTO draft_departments (draft_id, department_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM UNNEST(department_ids) as dept_id
                ON CONFLICT (draft_id, department_id) DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF field_ids IS NOT NULL THEN
                DELETE FROM draft_fields WHERE draft_id = v_draft_id;
                INSERT INTO draft_fields (draft_id, field_id, version)
                SELECT v_draft_id, field_id, v_new_version
                FROM UNNEST(field_ids) as field_id
                ON CONFLICT (draft_id, field_id) DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF example_ids IS NOT NULL THEN
                DELETE FROM draft_examples WHERE draft_id = v_draft_id;
                INSERT INTO draft_examples (draft_id, examples_id, version)
                SELECT v_draft_id, ex_id, v_new_version
                FROM UNNEST(example_ids) as ex_id
                ON CONFLICT (draft_id, examples_id) DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
            RETURN;
        END IF;
    END IF;
    
    -- Create new draft
    INSERT INTO drafts (artifact, profile_id, payload)
    VALUES ('persona'::artifacts, profile_id, '{}'::jsonb)
    RETURNING id, version INTO v_draft_id, v_new_version;
    
    -- Link resources to draft
    IF name_id IS NOT NULL THEN
        INSERT INTO draft_names (draft_id, name_id, version)
        VALUES (v_draft_id, name_id, v_new_version)
        ON CONFLICT (draft_id, name_id) DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF description_id IS NOT NULL THEN
        INSERT INTO draft_descriptions (draft_id, description_id, version)
        VALUES (v_draft_id, description_id, v_new_version)
        ON CONFLICT (draft_id, description_id) DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF color_id IS NOT NULL THEN
        INSERT INTO draft_colors (draft_id, color_id, version)
        VALUES (v_draft_id, color_id, v_new_version)
        ON CONFLICT (draft_id, color_id) DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF icon_id IS NOT NULL THEN
        INSERT INTO draft_icons (draft_id, icon_id, version)
        VALUES (v_draft_id, icon_id, v_new_version)
        ON CONFLICT (draft_id, icon_id) DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF instructions_id IS NOT NULL THEN
        INSERT INTO draft_instructions (draft_id, instruction_id, version)
        VALUES (v_draft_id, instructions_id, v_new_version)
        ON CONFLICT (draft_id, instruction_id) DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF active_flag_id IS NOT NULL THEN
        INSERT INTO draft_flags (draft_id, flag_id, version)
        VALUES (v_draft_id, active_flag_id, v_new_version)
        ON CONFLICT (draft_id, flag_id) DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    -- Handle array resources
    IF department_ids IS NOT NULL THEN
        INSERT INTO draft_departments (draft_id, department_id, version)
        SELECT v_draft_id, dept_id, v_new_version
        FROM UNNEST(department_ids) as dept_id
        ON CONFLICT (draft_id, department_id) DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF field_ids IS NOT NULL THEN
        INSERT INTO draft_fields (draft_id, field_id, version)
        SELECT v_draft_id, field_id, v_new_version
        FROM UNNEST(field_ids) as field_id
        ON CONFLICT (draft_id, field_id) DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF example_ids IS NOT NULL THEN
        INSERT INTO draft_examples (draft_id, examples_id, version)
        SELECT v_draft_id, ex_id, v_new_version
        FROM UNNEST(example_ids) as ex_id
        ON CONFLICT (draft_id, examples_id) DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;
