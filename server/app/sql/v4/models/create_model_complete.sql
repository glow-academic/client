-- Create model with department links, endpoint, and all related data
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
        WHERE proname = 'api_create_model_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_model_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_create_model_v4_%' OR typname LIKE 'q_create_model_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_create_model_v4_pricing AS (
    pricing_type text,
    unit_id uuid,
    price float
);

CREATE TYPE types.i_create_model_v4_temperature_bounds AS (
    bounds_type text,  -- 'range' or 'values'
    lower_bound float,
    upper_bound float,
    values_array float[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_create_model_v4(
    provider_id uuid,
    name text,
    description text,
    active boolean,
    value text,
    profile_id uuid,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    base_url text DEFAULT NULL,
    temperature_bounds types.i_create_model_v4_temperature_bounds DEFAULT NULL,
    pricing types.i_create_model_v4_pricing[] DEFAULT ARRAY[]::types.i_create_model_v4_pricing[],
    input_modalities text[] DEFAULT ARRAY[]::text[],
    output_modalities text[] DEFAULT ARRAY[]::text[],
    reasoning_levels text[] DEFAULT ARRAY[]::text[],
    voices text[] DEFAULT NULL,
    qualities text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE (
    model_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    new_model_id uuid;
    v_name_id uuid;
    v_description_id uuid;
    v_value_id uuid;
    default_voices text[] := ARRAY['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'];
    final_input_mods text[];
    final_output_mods text[];
    final_voices text[];
    temp_val float;
BEGIN
    -- Default modalities to text/text if not provided
    IF array_length(input_modalities, 1) IS NULL AND array_length(output_modalities, 1) IS NULL THEN
        final_input_mods := ARRAY['text'];
        final_output_mods := ARRAY['text'];
    ELSE
        final_input_mods := COALESCE(input_modalities, ARRAY[]::text[]);
        final_output_mods := COALESCE(output_modalities, ARRAY[]::text[]);
    END IF;

    -- Default voices to all voices if not provided
    IF voices IS NULL OR array_length(voices, 1) IS NULL THEN
        final_voices := default_voices;
    ELSE
        final_voices := voices;
    END IF;

    -- Validate permissions
    IF NOT validate_department_create_permissions(
        (SELECT r.role::text FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = profile_id LIMIT 1),
        ARRAY(SELECT unnest(department_ids)::text)
    ) THEN
        RAISE EXCEPTION 'Insufficient permissions to create model';
    END IF;

    -- Create model (without name, description, active, value - these go in junction tables)
    INSERT INTO model_artifact (provider_id)
    VALUES (provider_id)
    RETURNING id INTO new_model_id;

    -- Insert name into names_resource and link via model_names
    IF name IS NOT NULL AND name != '' THEN
        INSERT INTO names_resource (name, created_at, updated_at, active, generated, mcp, call_id)
        VALUES (name, NOW(), NOW(), true, false, false, NULL)
        ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
        RETURNING id INTO v_name_id;
        
        INSERT INTO model_names (model_id, name_id, created_at, updated_at, generated, mcp)
        VALUES (new_model_id, v_name_id, NOW(), NOW(), false, false)
        ON CONFLICT (model_id, name_id) DO NOTHING;
    END IF;

    -- Insert description into descriptions_resource and link via model_descriptions
    IF description IS NOT NULL AND description != '' THEN
        INSERT INTO descriptions_resource (description, created_at, updated_at, active, generated, mcp, call_id)
        VALUES (description, NOW(), NOW(), true, false, false, NULL)
        ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
        RETURNING id INTO v_description_id;
        
        INSERT INTO model_descriptions (model_id, description_id, created_at, updated_at, generated, mcp)
        VALUES (new_model_id, v_description_id, NOW(), NOW(), false, false)
        ON CONFLICT (model_id, description_id) DO NOTHING;
    END IF;

    -- Insert active flag into model_flags
    IF active IS NOT NULL THEN
        INSERT INTO model_flags (model_id, flag_id, type, value, created_at, updated_at, generated, mcp, call_id)
        SELECT 
            new_model_id,
            f.id,
            'active'::type_model_flags,
            active,
            NOW(),
            NOW(),
            false,
            false,
            NULL
        FROM flags_resource f
        WHERE f.name = 'active'
        ON CONFLICT (model_id, flag_id, type) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END IF;

    -- Insert value into values_resource and link via model_values
    IF value IS NOT NULL AND value != '' THEN
        INSERT INTO values_resource (value, created_at, updated_at, active, generated, mcp, call_id)
        VALUES (value, NOW(), NOW(), true, false, false, NULL)
        ON CONFLICT (value) DO UPDATE SET updated_at = NOW()
        RETURNING id INTO v_value_id;
        
        INSERT INTO model_values (model_id, value_id, created_at, updated_at, generated, mcp)
        VALUES (new_model_id, v_value_id, NOW(), NOW(), false, false)
        ON CONFLICT (model_id, value_id) DO NOTHING;
    END IF;

    -- Link departments if provided
    IF array_length(department_ids, 1) > 0 THEN
        INSERT INTO model_departments (model_id, department_id, active, created_at, updated_at)
        SELECT new_model_id, dept_id, true, NOW(), NOW()
        FROM UNNEST(department_ids) as dept_id
        ON CONFLICT (model_id, department_id) DO UPDATE SET
            active = true,
            updated_at = NOW();
    END IF;

    -- Create endpoint if base_url is provided
    IF base_url IS NOT NULL AND TRIM(base_url) != '' THEN
        INSERT INTO model_endpoints (model_id, base_url, active, created_at, updated_at)
        VALUES (new_model_id, base_url, true, NOW(), NOW())
        ON CONFLICT (model_id) DO UPDATE SET
            base_url = EXCLUDED.base_url,
            active = true,
            updated_at = NOW();
    END IF;

    -- Handle temperature bounds
    IF temperature_bounds IS NOT NULL THEN
        IF temperature_bounds.bounds_type = 'range' THEN
            INSERT INTO model_temperature_levels (model_id, temperature, is_upper, active)
            VALUES 
                (new_model_id, temperature_bounds.lower_bound, false, true),
                (new_model_id, temperature_bounds.upper_bound, true, true);
        ELSIF temperature_bounds.bounds_type = 'values' AND array_length(temperature_bounds.values_array, 1) > 0 THEN
            INSERT INTO model_temperature_levels (model_id, temperature, is_upper, active)
            SELECT new_model_id, temp_val, false, true
            FROM UNNEST(temperature_bounds.values_array) as temp_val;
        END IF;
    END IF;

    -- Handle pricing
    IF array_length(pricing, 1) > 0 THEN
        INSERT INTO model_pricing (model_id, pricing_type, unit_id, price, active)
        SELECT new_model_id, p.pricing_type::pricing_type, p.unit_id, p.price, true
        FROM UNNEST(pricing) as p;
    END IF;

    -- Handle modalities
    IF array_length(final_input_mods, 1) > 0 THEN
        INSERT INTO model_modalities (model_id, modality, is_input, active)
        SELECT new_model_id, mod::modality_type, true, true
        FROM UNNEST(final_input_mods) as mod;
    END IF;

    IF array_length(final_output_mods, 1) > 0 THEN
        INSERT INTO model_modalities (model_id, modality, is_input, active)
        SELECT new_model_id, mod::modality_type, false, true
        FROM UNNEST(final_output_mods) as mod;
    END IF;

    -- Handle reasoning levels
    IF array_length(reasoning_levels, 1) > 0 THEN
        INSERT INTO model_reasoning_levels (model_id, reasoning_level, active)
        SELECT new_model_id, level::reasoning_effort, true
        FROM UNNEST(reasoning_levels) as level;
    END IF;

    -- Handle voices
    IF array_length(final_voices, 1) > 0 THEN
        INSERT INTO model_voices (model_id, voice, active)
        SELECT new_model_id, voice::voice, true
        FROM UNNEST(final_voices) as voice;
    END IF;

    -- Handle qualities
    IF array_length(qualities, 1) > 0 THEN
        INSERT INTO model_qualities (model_id, quality, active)
        SELECT new_model_id, quality::quality, true
        FROM UNNEST(qualities) as quality;
    END IF;

    -- Return result
    RETURN QUERY
    SELECT 
        new_model_id as model_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM profile_artifact p
    WHERE p.id = profile_id;
END;
$$;