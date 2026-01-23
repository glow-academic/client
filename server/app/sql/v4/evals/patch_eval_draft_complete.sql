-- Patch eval draft - accepts resource IDs and creates/updates draft
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
        WHERE proname = 'api_patch_eval_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_eval_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_eval_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    agent_ids uuid[] DEFAULT NULL,
    model_run_ids uuid[] DEFAULT NULL,
    group_ids uuid[] DEFAULT NULL,
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
    
    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        -- Get existing draft's group_id
        SELECT group_id INTO v_group_id FROM drafts_entry WHERE id = input_draft_id;
        
        -- Create group if draft doesn't have one (shouldn't happen after migration, but safety check)
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at)
            VALUES (NOW(), NOW())
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
            DELETE FROM flags_draft WHERE flags_draft.draft_id = v_draft_id;
            DELETE FROM departments_draft WHERE departments_draft.draft_id = v_draft_id;
            DELETE FROM agents_draft WHERE agents_draft.draft_id = v_draft_id;
            IF model_run_ids IS NOT NULL THEN
                DELETE FROM runs_draft WHERE runs_draft.draft_id = v_draft_id;
                IF COALESCE(array_length(model_run_ids, 1), 0) > 0 THEN
                    INSERT INTO runs_draft (draft_id, runs_id, version)
                    SELECT v_draft_id, run_id, v_new_version
                    FROM UNNEST(model_run_ids) as run_id
                    ON CONFLICT ON CONSTRAINT runs_draft_pkey DO UPDATE
                    SET version = v_new_version;
                END IF;
            END IF;
            IF group_ids IS NOT NULL THEN
                DELETE FROM groups_draft WHERE groups_draft.draft_id = v_draft_id;
                IF COALESCE(array_length(group_ids, 1), 0) > 0 THEN
                    INSERT INTO groups_draft (draft_id, groups_id, version)
                    SELECT v_draft_id, group_id, v_new_version
                    FROM UNNEST(group_ids) as group_id
                    ON CONFLICT ON CONSTRAINT groups_draft_pkey DO UPDATE
                    SET version = v_new_version;
                END IF;
            END IF;
            
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
            
            -- Handle array resources (departments, agents)
            IF department_ids IS NOT NULL THEN
                DELETE FROM departments_draft WHERE departments_draft.draft_id = v_draft_id;
                INSERT INTO departments_draft (draft_id, departments_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM UNNEST(department_ids) as dept_id
                ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
            
            IF agent_ids IS NOT NULL THEN
                DELETE FROM agents_draft WHERE agents_draft.draft_id = v_draft_id;
                INSERT INTO agents_draft (draft_id, agents_id, version)
                SELECT v_draft_id, agent_id, v_new_version
                FROM UNNEST(agent_ids) as agent_id
                ON CONFLICT ON CONSTRAINT agents_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
            
            RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
            RETURN;
        END IF;
    END IF;
    
    -- Create new draft with group
    -- First create a group for this draft
    INSERT INTO groups_entry (created_at, updated_at)
    VALUES (NOW(), NOW())
    RETURNING id INTO v_group_id;
    
    -- Create new draft with group_id
    INSERT INTO drafts_entry (artifact, profile_id, group_id)
    VALUES ('eval'::artifact_type, v_profile_id, v_group_id)
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
    IF department_ids IS NOT NULL THEN
        INSERT INTO departments_draft (draft_id, departments_id, version)
        SELECT v_draft_id, dept_id, v_new_version
        FROM UNNEST(department_ids) as dept_id
        ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;
    
    IF agent_ids IS NOT NULL THEN
        INSERT INTO agents_draft (draft_id, agents_id, version)
        SELECT v_draft_id, agent_id, v_new_version
        FROM UNNEST(agent_ids) as agent_id
        ON CONFLICT ON CONSTRAINT agents_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF model_run_ids IS NOT NULL THEN
        INSERT INTO runs_draft (draft_id, runs_id, version)
        SELECT v_draft_id, run_id, v_new_version
        FROM UNNEST(model_run_ids) as run_id
        ON CONFLICT ON CONSTRAINT runs_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF group_ids IS NOT NULL THEN
        INSERT INTO groups_draft (draft_id, groups_id, version)
        SELECT v_draft_id, group_id, v_new_version
        FROM UNNEST(group_ids) as group_id
        ON CONFLICT ON CONSTRAINT groups_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;
