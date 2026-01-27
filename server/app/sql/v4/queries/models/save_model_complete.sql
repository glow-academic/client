-- Unified save model function - handles both create (model_id = NULL) and update (model_id provided)
-- Converted to function with composite types
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_save_model_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_model_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_save_model_v4_%' OR typname LIKE 'q_save_model_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types (no longer needed - using resource IDs directly)

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_save_model_v4(
    provider_id uuid,
    profile_id uuid,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    modalities_enabled_flag_id uuid DEFAULT NULL,
    temperature_enabled_flag_id uuid DEFAULT NULL,
    pricing_enabled_flag_id uuid DEFAULT NULL,
    voices_enabled_flag_id uuid DEFAULT NULL,
    reasoning_levels_enabled_flag_id uuid DEFAULT NULL,
    qualities_enabled_flag_id uuid DEFAULT NULL,
    value_id uuid DEFAULT NULL,
    endpoint_id uuid DEFAULT NULL,
    input_model_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    temperature_level_ids uuid[] DEFAULT ARRAY[]::uuid[],
    pricing_ids uuid[] DEFAULT ARRAY[]::uuid[],
    input_modality_ids uuid[] DEFAULT ARRAY[]::uuid[],
    output_modality_ids uuid[] DEFAULT ARRAY[]::uuid[],
    reasoning_level_ids uuid[] DEFAULT ARRAY[]::uuid[],
    voice_ids uuid[] DEFAULT NULL,
    quality_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    model_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_model_id uuid;
    v_actor_name text;
    is_create boolean;
    v_models_resource_id uuid;
    default_voice_ids uuid[];
    v_modality_id uuid;
    v_temperature_level_id uuid;
    v_reasoning_level_id uuid;
    v_quality_id uuid;
    v_pricing_id uuid;
BEGIN
    -- Determine if create or update
    is_create := (input_model_id IS NULL);
    
    -- Get default voice IDs if voice_ids not provided
    IF voice_ids IS NULL OR array_length(voice_ids, 1) IS NULL THEN
        SELECT ARRAY_AGG(id ORDER BY voice)
        INTO default_voice_ids
        FROM voices_resource
        WHERE active = true;
        
        IF default_voice_ids IS NULL THEN
            default_voice_ids := ARRAY[]::uuid[];
        END IF;
    ELSE
        default_voice_ids := voice_ids;
    END IF;

    -- Validate permissions
    IF is_create THEN
        IF NOT validate_department_create_permissions(
            (SELECT r.role::text FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = profile_id LIMIT 1),
            ARRAY(SELECT unnest(department_ids)::text)
        ) THEN
            RAISE EXCEPTION 'Insufficient permissions to create model';
        END IF;
    ELSE
        IF NOT validate_department_update_permissions(
            (SELECT r.role::text FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = profile_id LIMIT 1),
            ARRAY(SELECT department_id::text FROM model_departments_junction WHERE model_id = input_model_id AND active = true),
            ARRAY(SELECT department_id::text FROM profile_departments_junction WHERE view_sessions_entry.profile_id = api_save_model_v4.profile_id AND view_sessions_entry.active = true)
        ) THEN
            RAISE EXCEPTION 'Insufficient permissions to UPDATE model_artifact';
        END IF;
    END IF;

    -- Create or UPDATE model_artifact (without name, description, active, value - these go in junction tables)
    IF is_create THEN
        -- CREATE path
        INSERT INTO model_artifact (provider_id)
        VALUES (provider_id)
        RETURNING id INTO v_model_id;
    ELSE
        -- UPDATE path
        v_model_id := input_model_id;
        UPDATE model_artifact SET
            provider_id = api_save_model_v4.provider_id,
            updated_at = NOW()
        WHERE id = v_model_id;
    END IF;

    -- Handle name (using name_id resource ID)
    IF name_id IS NOT NULL THEN
        -- Delete existing name links and insert new one
        DELETE FROM model_names_junction WHERE model_id = v_model_id;
        INSERT INTO model_names_junction (model_id, name_id, created_at, generated, mcp)
        VALUES (v_model_id, name_id, NOW(), false, false);
    ELSE
        -- Remove name if name_id is NULL
        DELETE FROM model_names_junction WHERE model_id = v_model_id;
    END IF;

    -- Handle description (using description_id resource ID)
    IF description_id IS NOT NULL THEN
        -- Delete existing description links and insert new one
        DELETE FROM model_descriptions_junction WHERE model_id = v_model_id;
        INSERT INTO model_descriptions_junction (model_id, description_id, created_at, generated, mcp)
        VALUES (v_model_id, description_id, NOW(), false, false);
    ELSE
        -- Remove description if description_id is NULL
        DELETE FROM model_descriptions_junction WHERE model_id = v_model_id;
    END IF;

    -- Handle active flag (using active_flag_id resource ID)
    IF active_flag_id IS NOT NULL THEN
        -- Delete existing active flag links and insert new one
        DELETE FROM model_flags_junction WHERE model_id = v_model_id AND flag_id = active_flag_id;
        INSERT INTO model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, call_id)
        VALUES (v_model_id, active_flag_id, true, NOW(), false, false, NULL)
        ON CONFLICT (model_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
    ELSE
        -- Remove active flag if active_flag_id is NULL
        DELETE FROM model_flags_junction mf
        WHERE mf.model_id = v_model_id
        AND EXISTS (SELECT 1 FROM flags_resource f WHERE f.id = mf.flag_id AND f.name = 'model_active');
    END IF;

    -- Handle modalities_enabled flag
    IF modalities_enabled_flag_id IS NOT NULL THEN
        -- Delete existing flag of this type first
        DELETE FROM model_flags_junction mf
        WHERE mf.model_id = v_model_id
        AND EXISTS (SELECT 1 FROM flags_resource f WHERE f.id = mf.flag_id AND f.type = 'modalities_enabled'::flag_type);
        -- Insert new flag
        INSERT INTO model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, call_id)
        VALUES (v_model_id, modalities_enabled_flag_id, true, NOW(), false, false, NULL)
        ON CONFLICT (model_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
    ELSE
        -- Remove flag if flag_id is NULL
        DELETE FROM model_flags_junction mf
        WHERE mf.model_id = v_model_id
        AND EXISTS (SELECT 1 FROM flags_resource f WHERE f.id = mf.flag_id AND f.type = 'modalities_enabled'::flag_type);
    END IF;

    -- Handle temperature_enabled flag
    IF temperature_enabled_flag_id IS NOT NULL THEN
        DELETE FROM model_flags_junction mf
        WHERE mf.model_id = v_model_id
        AND EXISTS (SELECT 1 FROM flags_resource f WHERE f.id = mf.flag_id AND f.type = 'temperature_enabled'::flag_type);
        INSERT INTO model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, call_id)
        VALUES (v_model_id, temperature_enabled_flag_id, true, NOW(), false, false, NULL)
        ON CONFLICT (model_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
    ELSE
        DELETE FROM model_flags_junction mf
        WHERE mf.model_id = v_model_id
        AND EXISTS (SELECT 1 FROM flags_resource f WHERE f.id = mf.flag_id AND f.type = 'temperature_enabled'::flag_type);
    END IF;

    -- Handle pricing_enabled flag
    IF pricing_enabled_flag_id IS NOT NULL THEN
        DELETE FROM model_flags_junction mf
        WHERE mf.model_id = v_model_id
        AND EXISTS (SELECT 1 FROM flags_resource f WHERE f.id = mf.flag_id AND f.type = 'pricing_enabled'::flag_type);
        INSERT INTO model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, call_id)
        VALUES (v_model_id, pricing_enabled_flag_id, true, NOW(), false, false, NULL)
        ON CONFLICT (model_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
    ELSE
        DELETE FROM model_flags_junction mf
        WHERE mf.model_id = v_model_id
        AND EXISTS (SELECT 1 FROM flags_resource f WHERE f.id = mf.flag_id AND f.type = 'pricing_enabled'::flag_type);
    END IF;

    -- Handle voices_enabled flag
    IF voices_enabled_flag_id IS NOT NULL THEN
        DELETE FROM model_flags_junction mf
        WHERE mf.model_id = v_model_id
        AND EXISTS (SELECT 1 FROM flags_resource f WHERE f.id = mf.flag_id AND f.type = 'voices_enabled'::flag_type);
        INSERT INTO model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, call_id)
        VALUES (v_model_id, voices_enabled_flag_id, true, NOW(), false, false, NULL)
        ON CONFLICT (model_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
    ELSE
        DELETE FROM model_flags_junction mf
        WHERE mf.model_id = v_model_id
        AND EXISTS (SELECT 1 FROM flags_resource f WHERE f.id = mf.flag_id AND f.type = 'voices_enabled'::flag_type);
    END IF;

    -- Handle reasoning_levels_enabled flag
    IF reasoning_levels_enabled_flag_id IS NOT NULL THEN
        DELETE FROM model_flags_junction mf
        WHERE mf.model_id = v_model_id
        AND EXISTS (SELECT 1 FROM flags_resource f WHERE f.id = mf.flag_id AND f.type = 'reasoning_levels_enabled'::flag_type);
        INSERT INTO model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, call_id)
        VALUES (v_model_id, reasoning_levels_enabled_flag_id, true, NOW(), false, false, NULL)
        ON CONFLICT (model_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
    ELSE
        DELETE FROM model_flags_junction mf
        WHERE mf.model_id = v_model_id
        AND EXISTS (SELECT 1 FROM flags_resource f WHERE f.id = mf.flag_id AND f.type = 'reasoning_levels_enabled'::flag_type);
    END IF;

    -- Handle qualities_enabled flag
    IF qualities_enabled_flag_id IS NOT NULL THEN
        DELETE FROM model_flags_junction mf
        WHERE mf.model_id = v_model_id
        AND EXISTS (SELECT 1 FROM flags_resource f WHERE f.id = mf.flag_id AND f.type = 'qualities_enabled'::flag_type);
        INSERT INTO model_flags_junction (model_id, flag_id, value, created_at, generated, mcp, call_id)
        VALUES (v_model_id, qualities_enabled_flag_id, true, NOW(), false, false, NULL)
        ON CONFLICT (model_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
    ELSE
        DELETE FROM model_flags_junction mf
        WHERE mf.model_id = v_model_id
        AND EXISTS (SELECT 1 FROM flags_resource f WHERE f.id = mf.flag_id AND f.type = 'qualities_enabled'::flag_type);
    END IF;

    -- Handle value (using value_id resource ID)
    IF value_id IS NOT NULL THEN
        -- Delete existing value links and insert new one
        DELETE FROM model_values_junction WHERE model_id = v_model_id;
        INSERT INTO model_values_junction (model_id, value_id, created_at, generated, mcp)
        VALUES (v_model_id, value_id, NOW(), false, false);
    ELSE
        -- Remove value if value_id is NULL
        DELETE FROM model_values_junction WHERE model_id = v_model_id;
    END IF;

    -- Handle provider link (via model_providers_junction table)
    -- Note: model_providers_junction.model_id REFERENCES models_resource.id (resource), not model.id (artifact)
    -- So we need to get or create the models resource entry first
    -- Get or create models resource entry
    SELECT id INTO v_models_resource_id
    FROM models_resource
    WHERE model_id = v_model_id
    LIMIT 1;
    
    IF v_models_resource_id IS NULL THEN
        -- Create models resource entry if it doesn't exist (use active_flag_id to determine active status)
        INSERT INTO models_resource (model_id, active, generated, mcp, created_at)
        VALUES (v_model_id, active_flag_id IS NOT NULL, false, false, NOW())
        RETURNING id INTO v_models_resource_id;
    END IF;
    
    -- Link provider via model_providers_junction
    INSERT INTO model_providers_junction (model_id, providers_id, active, created_at)
    VALUES (v_models_resource_id, provider_id, true, NOW())
    ON CONFLICT (model_id, providers_id) DO UPDATE SET
        active = true;

    -- Handle departments
    IF NOT is_create THEN
        -- Deactivate all existing department links for update
        UPDATE model_departments_junction
        SET active = false
        WHERE model_id = v_model_id AND active = true;
    END IF;

    IF array_length(department_ids, 1) > 0 THEN
        INSERT INTO model_departments_junction (model_id, department_id, active, created_at)
        SELECT v_model_id, dept_id, true, NOW()
        FROM UNNEST(department_ids) as dept_id
        ON CONFLICT (model_id, department_id) DO UPDATE SET
            active = true;
    END IF;

    -- Handle endpoint (using endpoint_id resource ID)
    IF endpoint_id IS NOT NULL THEN
        -- Delete existing endpoint links and insert new one
        DELETE FROM model_endpoints_junction WHERE model_id = v_model_id;
        INSERT INTO model_endpoints_junction (model_id, endpoint_id, active, created_at, generated, mcp)
        VALUES (v_model_id, endpoint_id, true, NOW(), false, false);
    ELSE
        -- Remove endpoint if endpoint_id is NULL
        DELETE FROM model_endpoints_junction WHERE model_id = v_model_id;
    END IF;

    -- Handle temperature levels (using temperature_level_ids resource IDs)
    -- Deactivate existing temperature levels for update
    IF NOT is_create THEN
        UPDATE model_temperature_levels_junction SET active = false
        WHERE model_id = v_model_id;
    END IF;

    IF array_length(temperature_level_ids, 1) > 0 THEN
        INSERT INTO model_temperature_levels_junction (model_id, temperature_level_id, active, created_at, generated, mcp)
        SELECT v_model_id, temp_level_id, true, NOW(), false, false
        FROM UNNEST(temperature_level_ids) as temp_level_id
        ON CONFLICT (model_id, temperature_level_id) DO UPDATE SET active = true;
    END IF;

    -- Handle pricing (using pricing_ids resource IDs)
    -- Deactivate existing pricing for update
    IF NOT is_create THEN
        UPDATE model_pricing_junction SET active = false
        WHERE model_id = v_model_id;
    END IF;

    IF array_length(pricing_ids, 1) > 0 THEN
        INSERT INTO model_pricing_junction (model_id, pricing_id, active, created_at, generated, mcp)
        SELECT v_model_id, pricing_id, true, NOW(), false, false
        FROM UNNEST(pricing_ids) as pricing_id
        ON CONFLICT (model_id, pricing_id) DO UPDATE SET active = true;
    END IF;

    -- Handle modalities (using modality_ids resource IDs)
    -- Deactivate existing modalities for update
    IF NOT is_create THEN
        UPDATE model_modalities_junction SET active = false
        WHERE model_id = v_model_id;
    END IF;

    -- Default to text/text if no modalities provided
    IF array_length(input_modality_ids, 1) IS NULL AND array_length(output_modality_ids, 1) IS NULL THEN
        -- Get text modality IDs
        SELECT ARRAY_AGG(id)
        INTO input_modality_ids
        FROM modalities_resource
        WHERE modality = 'text'::modality_type AND active = true
        LIMIT 1;
        
        SELECT ARRAY_AGG(id)
        INTO output_modality_ids
        FROM modalities_resource
        WHERE modality = 'text'::modality_type AND active = true
        LIMIT 1;
    END IF;

    IF array_length(input_modality_ids, 1) > 0 THEN
        INSERT INTO model_modalities_junction (model_id, modality_id, type, active, created_at, generated, mcp)
        SELECT v_model_id, mod_id, 'input'::direction_type, true, NOW(), false, false
        FROM UNNEST(input_modality_ids) as mod_id
        ON CONFLICT (model_id, modality_id, type) DO UPDATE SET active = true;
    END IF;

    IF array_length(output_modality_ids, 1) > 0 THEN
        INSERT INTO model_modalities_junction (model_id, modality_id, type, active, created_at, generated, mcp)
        SELECT v_model_id, mod_id, 'output'::direction_type, true, NOW(), false, false
        FROM UNNEST(output_modality_ids) as mod_id
        ON CONFLICT (model_id, modality_id, type) DO UPDATE SET active = true;
    END IF;

    -- Handle reasoning levels (using reasoning_level_ids resource IDs)
    -- Deactivate existing reasoning levels for update
    IF NOT is_create THEN
        UPDATE model_reasoning_levels_junction SET active = false
        WHERE model_id = v_model_id;
    END IF;

    IF array_length(reasoning_level_ids, 1) > 0 THEN
        INSERT INTO model_reasoning_levels_junction (model_id, reasoning_level_id, active, created_at, generated, mcp)
        SELECT v_model_id, reasoning_level_id, true, NOW(), false, false
        FROM UNNEST(reasoning_level_ids) as reasoning_level_id
        ON CONFLICT (model_id, reasoning_level_id) DO UPDATE SET active = true;
    END IF;

    -- Handle voices (using voice_ids resource IDs)
    -- Always deactivate existing voices first for update
    IF NOT is_create THEN
        UPDATE model_voices_junction SET active = false
        WHERE model_id = v_model_id;
    END IF;

    IF array_length(default_voice_ids, 1) > 0 THEN
        INSERT INTO model_voices_junction (model_id, voice_id, active, created_at, generated, mcp)
        SELECT v_model_id, voice_id, true, NOW(), false, false
        FROM UNNEST(default_voice_ids) as voice_id
        ON CONFLICT (model_id, voice_id) DO UPDATE SET active = true;
    END IF;

    -- Handle qualities (using quality_ids resource IDs)
    -- Deactivate existing qualities for update
    IF NOT is_create THEN
        UPDATE model_qualities_junction SET active = false
        WHERE model_id = v_model_id;
    END IF;

    IF array_length(quality_ids, 1) > 0 THEN
        INSERT INTO model_qualities_junction (model_id, quality_id, active, created_at, generated, mcp)
        SELECT v_model_id, quality_id, true, NOW(), false, false
        FROM UNNEST(quality_ids) as quality_id
        ON CONFLICT (model_id, quality_id) DO UPDATE SET active = true;
    END IF;

    -- Sync linked resources with name/description
    UPDATE models_resource r
    SET name = n.name,
        description = d.description
    FROM model_models_junction j
    LEFT JOIN names_resource n ON n.id = name_id
    LEFT JOIN descriptions_resource d ON d.id = description_id
    WHERE j.models_id = r.id
      AND j.model_id = v_model_id;

    -- Return result
    RETURN QUERY
    SELECT 
        v_model_id as model_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''), 'System') as actor_name
    FROM profile_artifact p
    WHERE p.id = profile_id;
END;
$$;
