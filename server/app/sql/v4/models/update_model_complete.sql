-- Update model with department links, endpoint, and all related data
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_update_model_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_model_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_update_model_v4_%' OR typname LIKE 'q_update_model_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types (reuse same types as create)
CREATE TYPE types.i_update_model_v4_pricing AS (
    pricing_type text,
    unit_id uuid,
    price float
);

CREATE TYPE types.i_update_model_v4_temperature_bounds AS (
    bounds_type text,  -- 'range' or 'values'
    lower_bound float,
    upper_bound float,
    values_array float[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_update_model_v4(
    model_id uuid,
    provider_id uuid,
    name text,
    description text,
    active boolean,
    value text,
    profile_id uuid,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    base_url text DEFAULT NULL,
    temperature_bounds types.i_update_model_v4_temperature_bounds DEFAULT NULL,
    pricing types.i_update_model_v4_pricing[] DEFAULT ARRAY[]::types.i_update_model_v4_pricing[],
    input_modalities text[] DEFAULT ARRAY[]::text[],
    output_modalities text[] DEFAULT ARRAY[]::text[],
    reasoning_levels text[] DEFAULT ARRAY[]::text[],
    voices text[] DEFAULT NULL,
    qualities text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE (
    model_exists boolean,
    model_name text,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    model_exists_check boolean;
    final_input_mods text[];
    final_output_mods text[];
    default_voices text[] := ARRAY['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'];
    final_voices text[];
    temp_val float;
    updated_model_name text;
BEGIN
    -- Check if model exists
    SELECT EXISTS(SELECT 1 FROM models WHERE id = model_id) INTO model_exists_check;
    
    IF NOT model_exists_check THEN
        RETURN QUERY SELECT false::boolean, ''::text, ''::text;
        RETURN;
    END IF;

    -- Validate permissions
    IF NOT validate_department_update_permissions(
        (SELECT role::text FROM profiles WHERE id = profile_id),
        ARRAY(SELECT department_id::text FROM model_departments WHERE model_id = api_update_model_v4.model_id AND active = true),
        ARRAY(SELECT department_id::text FROM profile_departments WHERE profile_id = api_update_model_v4.profile_id AND active = true)
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to update model';
    END IF;

    -- Update model
    UPDATE models SET
        provider_id = api_update_model_v4.provider_id,
        name = api_update_model_v4.name,
        description = api_update_model_v4.description,
        active = api_update_model_v4.active,
        value = api_update_model_v4.value,
        updated_at = NOW()
    WHERE id = api_update_model_v4.model_id
    RETURNING name INTO updated_model_name;

    -- Deactivate all existing department links
    UPDATE model_departments
    SET active = false, updated_at = NOW()
    WHERE model_id = api_update_model_v4.model_id AND active = true;

    -- Link departments if provided
    IF array_length(department_ids, 1) > 0 THEN
        INSERT INTO model_departments (model_id, department_id, active, created_at, updated_at)
        SELECT api_update_model_v4.model_id, dept_id, true, NOW(), NOW()
        FROM UNNEST(department_ids) as dept_id
        ON CONFLICT (model_id, department_id) DO UPDATE SET
            active = true,
            updated_at = NOW();
    END IF;

    -- Update endpoint if base_url is provided
    IF base_url IS NOT NULL AND TRIM(base_url) != '' THEN
        INSERT INTO model_endpoints (model_id, base_url, active, created_at, updated_at)
        VALUES (api_update_model_v4.model_id, base_url, true, NOW(), NOW())
        ON CONFLICT (model_id) DO UPDATE SET
            base_url = EXCLUDED.base_url,
            active = true,
            updated_at = NOW();
    ELSE
        -- Deactivate endpoint if base_url is null or empty
        UPDATE model_endpoints
        SET active = false, updated_at = NOW()
        WHERE model_id = api_update_model_v4.model_id;
    END IF;

    -- Handle temperature bounds
    IF temperature_bounds IS NOT NULL THEN
        -- Deactivate existing temperature levels
        UPDATE model_temperature_levels SET active = false, updated_at = NOW()
        WHERE model_id = api_update_model_v4.model_id;

        IF temperature_bounds.bounds_type = 'range' THEN
            INSERT INTO model_temperature_levels (model_id, temperature, is_upper, active)
            VALUES 
                (api_update_model_v4.model_id, temperature_bounds.lower_bound, false, true),
                (api_update_model_v4.model_id, temperature_bounds.upper_bound, true, true)
            ON CONFLICT (model_id, temperature, is_upper) DO UPDATE SET active = true, updated_at = NOW();
        ELSIF temperature_bounds.bounds_type = 'values' AND array_length(temperature_bounds.values_array, 1) > 0 THEN
            INSERT INTO model_temperature_levels (model_id, temperature, is_upper, active)
            SELECT api_update_model_v4.model_id, temp_val, false, true
            FROM UNNEST(temperature_bounds.values_array) as temp_val
            ON CONFLICT (model_id, temperature, is_upper) DO UPDATE SET active = true, updated_at = NOW();
        END IF;
    END IF;

    -- Handle pricing
    IF array_length(pricing, 1) > 0 THEN
        -- Deactivate existing pricing
        UPDATE model_pricing SET active = false, updated_at = NOW()
        WHERE model_id = api_update_model_v4.model_id;

        -- Insert new pricing entries
        INSERT INTO model_pricing (model_id, pricing_type, unit_id, price, active)
        SELECT api_update_model_v4.model_id, p.pricing_type::pricing_type, p.unit_id, p.price, true
        FROM UNNEST(pricing) as p
        ON CONFLICT (model_id, pricing_type, unit_id) DO UPDATE SET
            price = EXCLUDED.price,
            active = true,
            updated_at = NOW();
    END IF;

    -- Default modalities to text/text if not provided
    IF array_length(input_modalities, 1) IS NULL AND array_length(output_modalities, 1) IS NULL THEN
        final_input_mods := ARRAY['text'];
        final_output_mods := ARRAY['text'];
    ELSE
        final_input_mods := COALESCE(input_modalities, ARRAY[]::text[]);
        final_output_mods := COALESCE(output_modalities, ARRAY[]::text[]);
    END IF;

    -- Handle modalities
    -- Deactivate existing modalities
    UPDATE model_modalities SET active = false, updated_at = NOW()
    WHERE model_id = api_update_model_v4.model_id;

    IF array_length(final_input_mods, 1) > 0 THEN
        INSERT INTO model_modalities (model_id, modality, is_input, active)
        SELECT api_update_model_v4.model_id, mod::modality_type, true, true
        FROM UNNEST(final_input_mods) as mod
        ON CONFLICT (model_id, modality, is_input) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    IF array_length(final_output_mods, 1) > 0 THEN
        INSERT INTO model_modalities (model_id, modality, is_input, active)
        SELECT api_update_model_v4.model_id, mod::modality_type, false, true
        FROM UNNEST(final_output_mods) as mod
        ON CONFLICT (model_id, modality, is_input) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    -- Handle reasoning levels
    IF array_length(reasoning_levels, 1) > 0 THEN
        -- Deactivate existing reasoning levels
        UPDATE model_reasoning_levels SET active = false, updated_at = NOW()
        WHERE model_id = api_update_model_v4.model_id;

        -- Insert new reasoning levels
        INSERT INTO model_reasoning_levels (model_id, reasoning_level, active)
        SELECT api_update_model_v4.model_id, level::reasoning_effort, true
        FROM UNNEST(reasoning_levels) as level
        ON CONFLICT (model_id, reasoning_level) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    -- Default voices to all voices if not provided
    IF voices IS NULL OR array_length(voices, 1) IS NULL THEN
        final_voices := default_voices;
    ELSE
        final_voices := voices;
    END IF;

    -- Handle voices
    -- Always deactivate existing voices first
    UPDATE model_voices SET active = false, updated_at = NOW()
    WHERE model_id = api_update_model_v4.model_id;

    IF array_length(final_voices, 1) > 0 THEN
        INSERT INTO model_voices (model_id, voice, active)
        SELECT api_update_model_v4.model_id, voice::voice, true
        FROM UNNEST(final_voices) as voice
        ON CONFLICT (model_id, voice) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    -- Handle qualities
    IF array_length(qualities, 1) > 0 THEN
        -- Deactivate existing qualities
        UPDATE model_qualities SET active = false, updated_at = NOW()
        WHERE model_id = api_update_model_v4.model_id;

        -- Insert new qualities
        INSERT INTO model_qualities (model_id, quality, active)
        SELECT api_update_model_v4.model_id, quality::quality, true
        FROM UNNEST(qualities) as quality
        ON CONFLICT (model_id, quality) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    -- Return result
    RETURN QUERY
    SELECT 
        true::boolean as model_exists,
        updated_model_name as model_name,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.id = profile_id;
END;
$$;