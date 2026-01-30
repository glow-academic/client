-- Patch simulation draft - accepts resource IDs and creates/updates draft
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
        WHERE proname = 'api_patch_simulation_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_simulation_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_simulation_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    scenario_ids uuid[] DEFAULT NULL,
    scenario_flag_ids uuid[] DEFAULT NULL,
    scenario_position_ids uuid[] DEFAULT NULL,
    scenario_rubric_ids uuid[] DEFAULT NULL,
    scenario_time_limit_ids uuid[] DEFAULT NULL,
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
    v_profile_id uuid := profile_id;  -- This is profile_artifact.id
    v_profiles_resource_id uuid;      -- This is profiles_resource.id (for FK)
    v_group_id uuid;
BEGIN
    -- Resolve profile_artifact.id to profiles_resource.id via junction table
    -- profiles_drafts_connection has FK to profiles_resource, not profile_artifact
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = v_profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profiles_resource linked to profile_artifact: %', v_profile_id;
    END IF;

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

    IF scenario_flag_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(scenario_flag_ids) AS scenario_flag_id
        WHERE NOT EXISTS (SELECT 1 FROM scenario_flags_resource WHERE id = scenario_flag_id)
    ) THEN
        RAISE EXCEPTION 'Scenario flag resource not found';
    END IF;

    IF scenario_position_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(scenario_position_ids) AS scenario_position_id
        WHERE NOT EXISTS (SELECT 1 FROM scenario_positions_resource WHERE id = scenario_position_id)
    ) THEN
        RAISE EXCEPTION 'Scenario position resource not found';
    END IF;

    IF scenario_rubric_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(scenario_rubric_ids) AS scenario_rubric_id
        WHERE NOT EXISTS (SELECT 1 FROM scenario_rubrics_resource WHERE id = scenario_rubric_id)
    ) THEN
        RAISE EXCEPTION 'Scenario rubric resource not found';
    END IF;

    IF scenario_time_limit_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(scenario_time_limit_ids) AS scenario_time_limit_id
        WHERE NOT EXISTS (SELECT 1 FROM scenario_time_limits_resource WHERE id = scenario_time_limit_id)
    ) THEN
        RAISE EXCEPTION 'Scenario time limit resource not found';
    END IF;
    
    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        -- Get existing draft's group_id
        SELECT group_id INTO v_group_id FROM view_drafts_entry WHERE id = input_draft_id;
        
        -- Create group if draft doesn't have one (shouldn't happen after migration, but safety check)
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (NOW(), NOW(), (SELECT id FROM view_sessions_entry WHERE view_sessions_entry.profile_id = v_profile_id AND view_sessions_entry.active = true ORDER BY created_at DESC LIMIT 1))
            RETURNING id INTO v_group_id;
        END IF;
        
        UPDATE drafts_entry
        SET version = drafts_entry.version + 1,
            updated_at = now(),
            group_id = COALESCE(drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (SELECT 1 FROM profiles_drafts_connection pdj WHERE pdj.draft_id = drafts_entry.id AND pdj.profiles_id = v_profiles_resource_id)
          AND drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;
        
        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
            
            -- Delete old resource links
            DELETE FROM names_drafts_connection WHERE names_drafts_connection.draft_id = v_draft_id;
            DELETE FROM descriptions_drafts_connection WHERE descriptions_drafts_connection.draft_id = v_draft_id;
            DELETE FROM flags_drafts_connection WHERE flags_drafts_connection.draft_id = v_draft_id;
            DELETE FROM departments_drafts_connection WHERE departments_drafts_connection.draft_id = v_draft_id;
            DELETE FROM scenarios_drafts_connection WHERE scenarios_drafts_connection.draft_id = v_draft_id;
            DELETE FROM scenario_flags_drafts_connection WHERE scenario_flags_drafts_connection.draft_id = v_draft_id;
            DELETE FROM scenario_positions_drafts_connection WHERE scenario_positions_drafts_connection.draft_id = v_draft_id;
            DELETE FROM scenario_rubrics_drafts_connection WHERE scenario_rubrics_drafts_connection.draft_id = v_draft_id;
            DELETE FROM scenario_time_limits_drafts_connection WHERE scenario_time_limits_drafts_connection.draft_id = v_draft_id;
            
            -- Insert new resource links
            IF name_id IS NOT NULL THEN
                INSERT INTO names_drafts_connection (draft_id, names_id, version)
                VALUES (v_draft_id, name_id, v_new_version)
                ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;
            
            IF description_id IS NOT NULL THEN
                INSERT INTO descriptions_drafts_connection (draft_id, descriptions_id, version)
                VALUES (v_draft_id, description_id, v_new_version)
                ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
            
            IF active_flag_id IS NOT NULL THEN
                INSERT INTO flags_drafts_connection (draft_id, flags_id, version)
                VALUES (v_draft_id, active_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
            
            -- Handle array resources
            IF department_ids IS NOT NULL THEN
                DELETE FROM departments_drafts_connection WHERE departments_drafts_connection.draft_id = v_draft_id;
                INSERT INTO departments_drafts_connection (draft_id, departments_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM UNNEST(department_ids) as dept_id
                ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
            
            IF scenario_ids IS NOT NULL THEN
                DELETE FROM scenarios_drafts_connection WHERE scenarios_drafts_connection.draft_id = v_draft_id;
                INSERT INTO scenarios_drafts_connection (draft_id, scenarios_id, version)
                SELECT v_draft_id, scenario_id, v_new_version
                FROM UNNEST(scenario_ids) as scenario_id
                ON CONFLICT ON CONSTRAINT scenarios_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF scenario_flag_ids IS NOT NULL THEN
                DELETE FROM scenario_flags_drafts_connection WHERE scenario_flags_drafts_connection.draft_id = v_draft_id;
                INSERT INTO scenario_flags_drafts_connection (draft_id, scenario_flags_id, version)
                SELECT v_draft_id, scenario_flag_id, v_new_version
                FROM UNNEST(scenario_flag_ids) as scenario_flag_id
                ON CONFLICT ON CONSTRAINT scenario_flags_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF scenario_position_ids IS NOT NULL THEN
                DELETE FROM scenario_positions_drafts_connection WHERE scenario_positions_drafts_connection.draft_id = v_draft_id;
                INSERT INTO scenario_positions_drafts_connection (draft_id, scenario_positions_id, version)
                SELECT v_draft_id, scenario_position_id, v_new_version
                FROM UNNEST(scenario_position_ids) as scenario_position_id
                ON CONFLICT ON CONSTRAINT scenario_positions_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF scenario_rubric_ids IS NOT NULL THEN
                DELETE FROM scenario_rubrics_drafts_connection WHERE scenario_rubrics_drafts_connection.draft_id = v_draft_id;
                INSERT INTO scenario_rubrics_drafts_connection (draft_id, scenario_rubrics_id, version)
                SELECT v_draft_id, scenario_rubric_id, v_new_version
                FROM UNNEST(scenario_rubric_ids) as scenario_rubric_id
                ON CONFLICT ON CONSTRAINT scenario_rubrics_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF scenario_time_limit_ids IS NOT NULL THEN
                DELETE FROM scenario_time_limits_drafts_connection WHERE scenario_time_limits_drafts_connection.draft_id = v_draft_id;
                INSERT INTO scenario_time_limits_drafts_connection (draft_id, scenario_time_limits_id, version)
                SELECT v_draft_id, scenario_time_limit_id, v_new_version
                FROM UNNEST(scenario_time_limit_ids) as scenario_time_limit_id
                ON CONFLICT ON CONSTRAINT scenario_time_limits_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
            
            RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
            RETURN;
        END IF;
    END IF;
    
    -- Create new draft with group
    -- First create a group for this draft
    INSERT INTO groups_entry (created_at, updated_at, session_id)
    VALUES (NOW(), NOW(), (SELECT id FROM view_sessions_entry WHERE view_sessions_entry.profile_id = v_profile_id AND view_sessions_entry.active = true ORDER BY created_at DESC LIMIT 1))
    RETURNING id INTO v_group_id;
    
    -- Create new draft with group_id
    INSERT INTO drafts_entry (artifact, group_id)
    VALUES ('simulation'::artifact_type, v_group_id)
    RETURNING id, version INTO v_draft_id, v_new_version;

    -- Link profile to draft (using profiles_resource.id, not profile_artifact.id)
    INSERT INTO profiles_drafts_connection (draft_id, profiles_id, version)
    VALUES (v_draft_id, v_profiles_resource_id, v_new_version);
    
    -- Link resources to draft
    IF name_id IS NOT NULL THEN
        INSERT INTO names_drafts_connection (draft_id, names_id, version)
        VALUES (v_draft_id, name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;
    
    IF description_id IS NOT NULL THEN
        INSERT INTO descriptions_drafts_connection (draft_id, descriptions_id, version)
        VALUES (v_draft_id, description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;
    
    IF active_flag_id IS NOT NULL THEN
        INSERT INTO flags_drafts_connection (draft_id, flags_id, version)
        VALUES (v_draft_id, active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;
    
    -- Handle array resources
    IF department_ids IS NOT NULL THEN
        INSERT INTO departments_drafts_connection (draft_id, departments_id, version)
        SELECT v_draft_id, dept_id, v_new_version
        FROM UNNEST(department_ids) as dept_id
        ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;
    
    IF scenario_ids IS NOT NULL THEN
        INSERT INTO scenarios_drafts_connection (draft_id, scenarios_id, version)
        SELECT v_draft_id, scenario_id, v_new_version
        FROM UNNEST(scenario_ids) as scenario_id
        ON CONFLICT ON CONSTRAINT scenarios_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF scenario_flag_ids IS NOT NULL THEN
        INSERT INTO scenario_flags_drafts_connection (draft_id, scenario_flags_id, version)
        SELECT v_draft_id, scenario_flag_id, v_new_version
        FROM UNNEST(scenario_flag_ids) as scenario_flag_id
        ON CONFLICT ON CONSTRAINT scenario_flags_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF scenario_position_ids IS NOT NULL THEN
        INSERT INTO scenario_positions_drafts_connection (draft_id, scenario_positions_id, version)
        SELECT v_draft_id, scenario_position_id, v_new_version
        FROM UNNEST(scenario_position_ids) as scenario_position_id
        ON CONFLICT ON CONSTRAINT scenario_positions_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF scenario_rubric_ids IS NOT NULL THEN
        INSERT INTO scenario_rubrics_drafts_connection (draft_id, scenario_rubrics_id, version)
        SELECT v_draft_id, scenario_rubric_id, v_new_version
        FROM UNNEST(scenario_rubric_ids) as scenario_rubric_id
        ON CONFLICT ON CONSTRAINT scenario_rubrics_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF scenario_time_limit_ids IS NOT NULL THEN
        INSERT INTO scenario_time_limits_drafts_connection (draft_id, scenario_time_limits_id, version)
        SELECT v_draft_id, scenario_time_limit_id, v_new_version
        FROM UNNEST(scenario_time_limit_ids) as scenario_time_limit_id
        ON CONFLICT ON CONSTRAINT scenario_time_limits_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;
