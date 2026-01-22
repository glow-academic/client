-- Patch model draft - accepts resource IDs and creates/updates draft
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
        WHERE proname = 'api_patch_model_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_model_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_model_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    value_id uuid DEFAULT NULL,
    endpoint_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    modalities_enabled_flag_id uuid DEFAULT NULL,
    temperature_enabled_flag_id uuid DEFAULT NULL,
    pricing_enabled_flag_id uuid DEFAULT NULL,
    voices_enabled_flag_id uuid DEFAULT NULL,
    reasoning_levels_enabled_flag_id uuid DEFAULT NULL,
    qualities_enabled_flag_id uuid DEFAULT NULL,
    provider_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    input_modality_ids uuid[] DEFAULT NULL,
    output_modality_ids uuid[] DEFAULT NULL,
    temperature_level_ids uuid[] DEFAULT NULL,
    reasoning_level_ids uuid[] DEFAULT NULL,
    quality_ids uuid[] DEFAULT NULL,
    pricing_ids uuid[] DEFAULT NULL,
    voice_ids uuid[] DEFAULT NULL,
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

    IF value_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM values_resource WHERE id = value_id) THEN
        RAISE EXCEPTION 'Value resource not found: %', value_id;
    END IF;

    IF endpoint_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM endpoints_resource WHERE id = endpoint_id) THEN
        RAISE EXCEPTION 'Endpoint resource not found: %', endpoint_id;
    END IF;
    
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;

    IF modalities_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = modalities_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', modalities_enabled_flag_id;
    END IF;

    IF temperature_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = temperature_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', temperature_enabled_flag_id;
    END IF;

    IF pricing_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = pricing_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', pricing_enabled_flag_id;
    END IF;

    IF voices_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = voices_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', voices_enabled_flag_id;
    END IF;

    IF reasoning_levels_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = reasoning_levels_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', reasoning_levels_enabled_flag_id;
    END IF;

    IF qualities_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = qualities_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', qualities_enabled_flag_id;
    END IF;
    
    IF provider_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM providers_resource WHERE id = provider_id) THEN
        RAISE EXCEPTION 'Provider resource not found: %', provider_id;
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
            DELETE FROM flags_draft WHERE flags_draft.draft_id = v_draft_id;
            DELETE FROM providers_draft WHERE providers_draft.draft_id = v_draft_id;
            DELETE FROM values_draft WHERE values_draft.draft_id = v_draft_id;
            DELETE FROM endpoints_draft WHERE endpoints_draft.draft_id = v_draft_id;
            DELETE FROM departments_draft WHERE departments_draft.draft_id = v_draft_id;
            DELETE FROM modalities_draft WHERE modalities_draft.draft_id = v_draft_id;
            DELETE FROM temperature_levels_draft WHERE temperature_levels_draft.draft_id = v_draft_id;
            DELETE FROM reasoning_levels_draft WHERE reasoning_levels_draft.draft_id = v_draft_id;
            DELETE FROM qualities_draft WHERE qualities_draft.draft_id = v_draft_id;
            DELETE FROM pricing_draft WHERE pricing_draft.draft_id = v_draft_id;
            DELETE FROM voices_draft WHERE voices_draft.draft_id = v_draft_id;
            
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
            
            IF active_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, active_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF modalities_enabled_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, modalities_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF temperature_enabled_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, temperature_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF pricing_enabled_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, pricing_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF voices_enabled_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, voices_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF reasoning_levels_enabled_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, reasoning_levels_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF qualities_enabled_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, qualities_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF provider_id IS NOT NULL THEN
                INSERT INTO providers_draft (draft_id, providers_id, version)
                VALUES (v_draft_id, provider_id, v_new_version)
                ON CONFLICT ON CONSTRAINT providers_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF value_id IS NOT NULL THEN
                INSERT INTO values_draft (draft_id, values_id, version)
                VALUES (v_draft_id, value_id, v_new_version)
                ON CONFLICT ON CONSTRAINT values_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF endpoint_id IS NOT NULL THEN
                INSERT INTO endpoints_draft (draft_id, endpoints_id, version)
                VALUES (v_draft_id, endpoint_id, v_new_version)
                ON CONFLICT ON CONSTRAINT endpoints_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF department_ids IS NOT NULL THEN
                DELETE FROM departments_draft WHERE departments_draft.draft_id = v_draft_id;
                INSERT INTO departments_draft (draft_id, departments_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM UNNEST(department_ids) as dept_id
                ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF input_modality_ids IS NOT NULL OR output_modality_ids IS NOT NULL THEN
                DELETE FROM modalities_draft WHERE modalities_draft.draft_id = v_draft_id;
                INSERT INTO modalities_draft (draft_id, modalities_id, version)
                SELECT v_draft_id, mod_id, v_new_version
                FROM (
                    SELECT DISTINCT UNNEST(
                        COALESCE(input_modality_ids, ARRAY[]::uuid[]) ||
                        COALESCE(output_modality_ids, ARRAY[]::uuid[])
                    ) as mod_id
                ) as merged
                ON CONFLICT ON CONSTRAINT modalities_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF temperature_level_ids IS NOT NULL THEN
                DELETE FROM temperature_levels_draft WHERE temperature_levels_draft.draft_id = v_draft_id;
                INSERT INTO temperature_levels_draft (draft_id, temperature_levels_id, version)
                SELECT v_draft_id, temp_id, v_new_version
                FROM UNNEST(temperature_level_ids) as temp_id
                ON CONFLICT ON CONSTRAINT temperature_levels_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF reasoning_level_ids IS NOT NULL THEN
                DELETE FROM reasoning_levels_draft WHERE reasoning_levels_draft.draft_id = v_draft_id;
                INSERT INTO reasoning_levels_draft (draft_id, reasoning_levels_id, version)
                SELECT v_draft_id, reasoning_id, v_new_version
                FROM UNNEST(reasoning_level_ids) as reasoning_id
                ON CONFLICT ON CONSTRAINT reasoning_levels_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF quality_ids IS NOT NULL THEN
                DELETE FROM qualities_draft WHERE qualities_draft.draft_id = v_draft_id;
                INSERT INTO qualities_draft (draft_id, qualities_id, version)
                SELECT v_draft_id, quality_id, v_new_version
                FROM UNNEST(quality_ids) as quality_id
                ON CONFLICT ON CONSTRAINT qualities_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF pricing_ids IS NOT NULL THEN
                DELETE FROM pricing_draft WHERE pricing_draft.draft_id = v_draft_id;
                INSERT INTO pricing_draft (draft_id, pricing_id, version)
                SELECT v_draft_id, pricing_id, v_new_version
                FROM UNNEST(pricing_ids) as pricing_id
                ON CONFLICT ON CONSTRAINT pricing_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF voice_ids IS NOT NULL THEN
                DELETE FROM voices_draft WHERE voices_draft.draft_id = v_draft_id;
                INSERT INTO voices_draft (draft_id, voices_id, version)
                SELECT v_draft_id, voice_id, v_new_version
                FROM UNNEST(voice_ids) as voice_id
                ON CONFLICT ON CONSTRAINT voices_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
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
    VALUES ('model'::artifacts, v_profile_id, v_group_id)
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
    
    IF active_flag_id IS NOT NULL THEN
        INSERT INTO flags_draft (draft_id, flags_id, version)
        VALUES (v_draft_id, active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF modalities_enabled_flag_id IS NOT NULL THEN
        INSERT INTO flags_draft (draft_id, flags_id, version)
        VALUES (v_draft_id, modalities_enabled_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF temperature_enabled_flag_id IS NOT NULL THEN
        INSERT INTO flags_draft (draft_id, flags_id, version)
        VALUES (v_draft_id, temperature_enabled_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF pricing_enabled_flag_id IS NOT NULL THEN
        INSERT INTO flags_draft (draft_id, flags_id, version)
        VALUES (v_draft_id, pricing_enabled_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF voices_enabled_flag_id IS NOT NULL THEN
        INSERT INTO flags_draft (draft_id, flags_id, version)
        VALUES (v_draft_id, voices_enabled_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF reasoning_levels_enabled_flag_id IS NOT NULL THEN
        INSERT INTO flags_draft (draft_id, flags_id, version)
        VALUES (v_draft_id, reasoning_levels_enabled_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF qualities_enabled_flag_id IS NOT NULL THEN
        INSERT INTO flags_draft (draft_id, flags_id, version)
        VALUES (v_draft_id, qualities_enabled_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF provider_id IS NOT NULL THEN
        INSERT INTO providers_draft (draft_id, providers_id, version)
        VALUES (v_draft_id, provider_id, v_new_version)
        ON CONFLICT ON CONSTRAINT providers_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF value_id IS NOT NULL THEN
        INSERT INTO values_draft (draft_id, values_id, version)
        VALUES (v_draft_id, value_id, v_new_version)
        ON CONFLICT ON CONSTRAINT values_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF endpoint_id IS NOT NULL THEN
        INSERT INTO endpoints_draft (draft_id, endpoints_id, version)
        VALUES (v_draft_id, endpoint_id, v_new_version)
        ON CONFLICT ON CONSTRAINT endpoints_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF department_ids IS NOT NULL THEN
        INSERT INTO departments_draft (draft_id, departments_id, version)
        SELECT v_draft_id, dept_id, v_new_version
        FROM UNNEST(department_ids) as dept_id
        ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF input_modality_ids IS NOT NULL OR output_modality_ids IS NOT NULL THEN
        INSERT INTO modalities_draft (draft_id, modalities_id, version)
        SELECT v_draft_id, mod_id, v_new_version
        FROM (
            SELECT DISTINCT UNNEST(
                COALESCE(input_modality_ids, ARRAY[]::uuid[]) ||
                COALESCE(output_modality_ids, ARRAY[]::uuid[])
            ) as mod_id
        ) as merged
        ON CONFLICT ON CONSTRAINT modalities_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF temperature_level_ids IS NOT NULL THEN
        INSERT INTO temperature_levels_draft (draft_id, temperature_levels_id, version)
        SELECT v_draft_id, temp_id, v_new_version
        FROM UNNEST(temperature_level_ids) as temp_id
        ON CONFLICT ON CONSTRAINT temperature_levels_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF reasoning_level_ids IS NOT NULL THEN
        INSERT INTO reasoning_levels_draft (draft_id, reasoning_levels_id, version)
        SELECT v_draft_id, reasoning_id, v_new_version
        FROM UNNEST(reasoning_level_ids) as reasoning_id
        ON CONFLICT ON CONSTRAINT reasoning_levels_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF quality_ids IS NOT NULL THEN
        INSERT INTO qualities_draft (draft_id, qualities_id, version)
        SELECT v_draft_id, quality_id, v_new_version
        FROM UNNEST(quality_ids) as quality_id
        ON CONFLICT ON CONSTRAINT qualities_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF pricing_ids IS NOT NULL THEN
        INSERT INTO pricing_draft (draft_id, pricing_id, version)
        SELECT v_draft_id, pricing_id, v_new_version
        FROM UNNEST(pricing_ids) as pricing_id
        ON CONFLICT ON CONSTRAINT pricing_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF voice_ids IS NOT NULL THEN
        INSERT INTO voices_draft (draft_id, voices_id, version)
        SELECT v_draft_id, voice_id, v_new_version
        FROM UNNEST(voice_ids) as voice_id
        ON CONFLICT ON CONSTRAINT voices_draft_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;
