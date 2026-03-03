-- Unified save model function - handles both create (model_id = NULL) and update (model_id provided)
-- Uses nested resource action composites with tool call tracking.

-- 0) Drop and recreate composite types for resource actions
DO $$
BEGIN
    DROP TYPE IF EXISTS types.model_resource_action CASCADE;
    CREATE TYPE types.model_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.model_multi_resource_action CASCADE;
    CREATE TYPE types.model_multi_resource_action AS (
        resource_ids uuid[],
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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

-- 2) Recreate function with composite resource action parameters
CREATE OR REPLACE FUNCTION api_save_model_v4(
    profile_id uuid,
    input_model_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.model_resource_action DEFAULT NULL,
    descriptions types.model_resource_action DEFAULT NULL,
    "values" types.model_resource_action DEFAULT NULL,
    providers types.model_resource_action DEFAULT NULL,
    flags types.model_multi_resource_action DEFAULT NULL,
    departments types.model_multi_resource_action DEFAULT NULL,
    modalities types.model_multi_resource_action DEFAULT NULL,
    temperature_levels types.model_multi_resource_action DEFAULT NULL,
    pricing types.model_multi_resource_action DEFAULT NULL,
    reasoning_levels types.model_multi_resource_action DEFAULT NULL,
    qualities types.model_multi_resource_action DEFAULT NULL,
    voices types.model_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    model_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_model_id uuid;
    is_create boolean;

    -- Extracted resource IDs
    v_name_id uuid;
    v_description_id uuid;
    v_value_id uuid;
    v_provider_id uuid;
    v_flag_ids uuid[];
    v_department_ids uuid[];
    v_modality_ids uuid[];
    v_temperature_level_ids uuid[];
    v_pricing_ids uuid[];
    v_reasoning_level_ids uuid[];
    v_quality_ids uuid[];
    v_voice_ids uuid[];

    -- Call tracking
    v_run_id uuid;
    v_call_id uuid;

    -- Defaults
    default_voice_ids uuid[];
BEGIN
    -- Extract resource IDs from composites
    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_value_id := ("values").resource_id;
    v_provider_id := (providers).resource_id;
    v_flag_ids := COALESCE((flags).resource_ids, ARRAY[]::uuid[]);
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_modality_ids := COALESCE((modalities).resource_ids, ARRAY[]::uuid[]);
    v_temperature_level_ids := COALESCE((temperature_levels).resource_ids, ARRAY[]::uuid[]);
    v_pricing_ids := COALESCE((pricing).resource_ids, ARRAY[]::uuid[]);
    v_reasoning_level_ids := COALESCE((reasoning_levels).resource_ids, ARRAY[]::uuid[]);
    v_quality_ids := COALESCE((qualities).resource_ids, ARRAY[]::uuid[]);
    v_voice_ids := COALESCE((voices).resource_ids, ARRAY[]::uuid[]);

    -- Determine create vs update
    is_create := (input_model_id IS NULL);

    -- Get default voice IDs if none provided
    IF array_length(v_voice_ids, 1) IS NULL THEN
        SELECT ARRAY_AGG(id ORDER BY voice)
        INTO default_voice_ids
        FROM voices_resource
        WHERE active = true;

        IF default_voice_ids IS NULL THEN
            default_voice_ids := ARRAY[]::uuid[];
        END IF;
        v_voice_ids := default_voice_ids;
    END IF;

    -- Default to text modalities if none provided
    IF array_length(v_modality_ids, 1) IS NULL THEN
        SELECT ARRAY_AGG(id)
        INTO v_modality_ids
        FROM modalities_resource
        WHERE modality = 'text'::modality_type AND active = true;

        IF v_modality_ids IS NULL THEN
            v_modality_ids := ARRAY[]::uuid[];
        END IF;
    END IF;

    -- Create or update model artifact
    IF is_create THEN
        INSERT INTO model_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_model_id;
    ELSE
        v_model_id := input_model_id;
        UPDATE model_artifact SET updated_at = NOW()
        WHERE id = v_model_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Model not found: %', input_model_id;
        END IF;
    END IF;

    -- Link group to model
    IF group_id IS NOT NULL THEN
        INSERT INTO model_groups_junction (model_id, group_id, created_at, active, generated, mcp)
        VALUES (v_model_id, group_id, NOW(), true, false, false)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Validate resource IDs exist
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_value_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM values_resource WHERE id = v_value_id) THEN
        RAISE EXCEPTION 'Value resource not found: %', v_value_id;
    END IF;

    IF v_provider_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM providers_resource WHERE id = v_provider_id) THEN
        RAISE EXCEPTION 'Provider resource not found: %', v_provider_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_flag_ids) AS fid
        WHERE NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = fid)
    ) THEN
        RAISE EXCEPTION 'One or more flag_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_department_ids) AS did
        WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = did)
    ) THEN
        RAISE EXCEPTION 'One or more department_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_modality_ids) AS mid
        WHERE NOT EXISTS (SELECT 1 FROM modalities_resource WHERE id = mid)
    ) THEN
        RAISE EXCEPTION 'One or more modality_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_temperature_level_ids) AS tid
        WHERE NOT EXISTS (SELECT 1 FROM temperature_levels_resource WHERE id = tid)
    ) THEN
        RAISE EXCEPTION 'One or more temperature_level_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_pricing_ids) AS pid
        WHERE NOT EXISTS (SELECT 1 FROM pricing_resource WHERE id = pid)
    ) THEN
        RAISE EXCEPTION 'One or more pricing_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_reasoning_level_ids) AS rid
        WHERE NOT EXISTS (SELECT 1 FROM reasoning_levels_resource WHERE id = rid)
    ) THEN
        RAISE EXCEPTION 'One or more reasoning_level_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_quality_ids) AS qid
        WHERE NOT EXISTS (SELECT 1 FROM qualities_resource WHERE id = qid)
    ) THEN
        RAISE EXCEPTION 'One or more quality_ids not found';
    END IF;

    -- Deactivate old links on update
    IF NOT is_create THEN
        UPDATE model_names_junction SET active = false WHERE model_id = v_model_id AND active = true;
        UPDATE model_descriptions_junction SET active = false WHERE model_id = v_model_id AND active = true;
        UPDATE model_values_junction SET active = false WHERE model_id = v_model_id AND active = true;
        UPDATE model_providers_junction SET active = false WHERE model_id = v_model_id AND active = true;
        UPDATE model_flags_junction SET active = false WHERE model_id = v_model_id AND active = true;
        UPDATE model_departments_junction SET active = false WHERE model_id = v_model_id AND active = true;
        UPDATE model_modalities_junction SET active = false WHERE model_id = v_model_id AND active = true;
        UPDATE model_temperature_levels_junction SET active = false WHERE model_id = v_model_id;
        UPDATE model_pricing_junction SET active = false WHERE model_id = v_model_id;
        UPDATE model_reasoning_levels_junction SET active = false WHERE model_id = v_model_id;
        UPDATE model_voices_junction SET active = false WHERE model_id = v_model_id;
        UPDATE model_qualities_junction SET active = false WHERE model_id = v_model_id;
    END IF;

    -- Tool-call tracking: one run per save
    v_run_id := uuidv7();
    INSERT INTO runs_entry (id, group_id, created_at, updated_at)
    VALUES (v_run_id, group_id, NOW(), NOW());

    -- names
    IF v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_create_names_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_link_names_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    -- descriptions
    IF v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_create_descriptions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_link_descriptions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    -- values
    IF v_value_id IS NOT NULL THEN
        IF ("values").create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_create_values_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (("values").create_tool_id, v_call_id);
            INSERT INTO values_calls_connection (values_id, call_id) VALUES (v_value_id, v_call_id);
        END IF;
        IF ("values").link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_link_values_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (("values").link_tool_id, v_call_id);
            INSERT INTO values_calls_connection (values_id, call_id) VALUES (v_value_id, v_call_id);
        END IF;
    END IF;

    -- providers
    IF v_provider_id IS NOT NULL THEN
        IF (providers).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_create_providers_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((providers).create_tool_id, v_call_id);
            INSERT INTO providers_calls_connection (providers_id, call_id) VALUES (v_provider_id, v_call_id);
        END IF;
        IF (providers).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_link_providers_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((providers).link_tool_id, v_call_id);
            INSERT INTO providers_calls_connection (providers_id, call_id) VALUES (v_provider_id, v_call_id);
        END IF;
    END IF;

    -- Multi-resource tool call trackers
    IF COALESCE(array_length(v_flag_ids, 1), 0) > 0 THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_create_flags_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id)
            SELECT fid, v_call_id FROM UNNEST(v_flag_ids) fid;
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_link_flags_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id)
            SELECT fid, v_call_id FROM UNNEST(v_flag_ids) fid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_create_departments_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;
        IF (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_link_departments_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;
    END IF;

    IF COALESCE(array_length(v_modality_ids, 1), 0) > 0 THEN
        IF (modalities).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_create_modalities_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((modalities).create_tool_id, v_call_id);
            INSERT INTO modalities_calls_connection (modalities_id, call_id)
            SELECT mid, v_call_id FROM UNNEST(v_modality_ids) mid;
        END IF;
        IF (modalities).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_link_modalities_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((modalities).link_tool_id, v_call_id);
            INSERT INTO modalities_calls_connection (modalities_id, call_id)
            SELECT mid, v_call_id FROM UNNEST(v_modality_ids) mid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_temperature_level_ids, 1), 0) > 0 THEN
        IF (temperature_levels).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_create_temperature_levels_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((temperature_levels).create_tool_id, v_call_id);
            INSERT INTO temperature_levels_calls_connection (temperature_levels_id, call_id)
            SELECT tid, v_call_id FROM UNNEST(v_temperature_level_ids) tid;
        END IF;
        IF (temperature_levels).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_link_temperature_levels_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((temperature_levels).link_tool_id, v_call_id);
            INSERT INTO temperature_levels_calls_connection (temperature_levels_id, call_id)
            SELECT tid, v_call_id FROM UNNEST(v_temperature_level_ids) tid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_pricing_ids, 1), 0) > 0 THEN
        IF (pricing).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_create_pricing_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((pricing).create_tool_id, v_call_id);
            INSERT INTO pricing_calls_connection (pricing_id, call_id)
            SELECT pid, v_call_id FROM UNNEST(v_pricing_ids) pid;
        END IF;
        IF (pricing).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_link_pricing_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((pricing).link_tool_id, v_call_id);
            INSERT INTO pricing_calls_connection (pricing_id, call_id)
            SELECT pid, v_call_id FROM UNNEST(v_pricing_ids) pid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_reasoning_level_ids, 1), 0) > 0 THEN
        IF (reasoning_levels).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_create_reasoning_levels_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((reasoning_levels).create_tool_id, v_call_id);
            INSERT INTO reasoning_levels_calls_connection (reasoning_levels_id, call_id)
            SELECT rid, v_call_id FROM UNNEST(v_reasoning_level_ids) rid;
        END IF;
        IF (reasoning_levels).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_link_reasoning_levels_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((reasoning_levels).link_tool_id, v_call_id);
            INSERT INTO reasoning_levels_calls_connection (reasoning_levels_id, call_id)
            SELECT rid, v_call_id FROM UNNEST(v_reasoning_level_ids) rid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_quality_ids, 1), 0) > 0 THEN
        IF (qualities).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_create_qualities_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((qualities).create_tool_id, v_call_id);
            INSERT INTO qualities_calls_connection (qualities_id, call_id)
            SELECT qid, v_call_id FROM UNNEST(v_quality_ids) qid;
        END IF;
        IF (qualities).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_link_qualities_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((qualities).link_tool_id, v_call_id);
            INSERT INTO qualities_calls_connection (qualities_id, call_id)
            SELECT qid, v_call_id FROM UNNEST(v_quality_ids) qid;
        END IF;
    END IF;

    IF COALESCE(array_length(v_voice_ids, 1), 0) > 0 THEN
        IF (voices).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_create_voices_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((voices).create_tool_id, v_call_id);
            INSERT INTO voices_calls_connection (voices_id, call_id)
            SELECT vid, v_call_id FROM UNNEST(v_voice_ids) vid;
        END IF;
        IF (voices).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'model_save_link_voices_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((voices).link_tool_id, v_call_id);
            INSERT INTO voices_calls_connection (voices_id, call_id)
            SELECT vid, v_call_id FROM UNNEST(v_voice_ids) vid;
        END IF;
    END IF;

    -- Upsert active links: single-select resources
    IF v_name_id IS NOT NULL THEN
        INSERT INTO model_names_junction (model_id, name_id, created_at, generated, mcp)
        VALUES (v_model_id, v_name_id, NOW(), false, false)
        ON CONFLICT ON CONSTRAINT model_names_pkey DO UPDATE
        SET generated = false, mcp = false;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO model_descriptions_junction (model_id, description_id, created_at, generated, mcp)
        VALUES (v_model_id, v_description_id, NOW(), false, false)
        ON CONFLICT ON CONSTRAINT model_descriptions_pkey DO UPDATE
        SET generated = false, mcp = false;
    END IF;

    IF v_value_id IS NOT NULL THEN
        INSERT INTO model_values_junction (model_id, value_id, created_at, generated, mcp)
        VALUES (v_model_id, v_value_id, NOW(), false, false)
        ON CONFLICT ON CONSTRAINT model_values_pkey DO UPDATE
        SET generated = false, mcp = false;
    END IF;

    IF v_provider_id IS NOT NULL THEN
        INSERT INTO model_providers_junction (model_id, providers_id, active, created_at)
        VALUES (v_model_id, v_provider_id, true, NOW())
        ON CONFLICT ON CONSTRAINT model_providers_pkey DO UPDATE
        SET active = true;
    END IF;

    -- Upsert active links: multi-select resources
    INSERT INTO model_flags_junction (model_id, flag_id, value, created_at, generated, mcp)
    SELECT v_model_id, fid, true, NOW(), false, false
    FROM UNNEST(v_flag_ids) fid
    ON CONFLICT ON CONSTRAINT model_flags_pkey DO UPDATE
    SET value = true, generated = false, mcp = false;

    INSERT INTO model_departments_junction (model_id, department_id, active, created_at)
    SELECT v_model_id, did, true, NOW()
    FROM UNNEST(v_department_ids) did
    ON CONFLICT ON CONSTRAINT model_departments_pkey DO UPDATE
    SET active = true;

    INSERT INTO model_modalities_junction (model_id, modality_id, active, created_at, generated, mcp)
    SELECT v_model_id, mid, true, NOW(), false, false
    FROM UNNEST(v_modality_ids) mid
    ON CONFLICT ON CONSTRAINT model_modalities_pkey DO UPDATE
    SET active = true, generated = false, mcp = false;

    INSERT INTO model_temperature_levels_junction (model_id, temperature_level_id, active, created_at, generated, mcp)
    SELECT v_model_id, tid, true, NOW(), false, false
    FROM UNNEST(v_temperature_level_ids) tid
    ON CONFLICT ON CONSTRAINT model_temperature_levels_pkey DO UPDATE
    SET active = true;

    INSERT INTO model_pricing_junction (model_id, pricing_id, active, created_at, generated, mcp)
    SELECT v_model_id, pid, true, NOW(), false, false
    FROM UNNEST(v_pricing_ids) pid
    ON CONFLICT ON CONSTRAINT model_pricing_pkey DO UPDATE
    SET active = true;

    INSERT INTO model_reasoning_levels_junction (model_id, reasoning_level_id, active, created_at, generated, mcp)
    SELECT v_model_id, rid, true, NOW(), false, false
    FROM UNNEST(v_reasoning_level_ids) rid
    ON CONFLICT ON CONSTRAINT model_reasoning_levels_pkey DO UPDATE
    SET active = true;

    INSERT INTO model_qualities_junction (model_id, quality_id, active, created_at, generated, mcp)
    SELECT v_model_id, qid, true, NOW(), false, false
    FROM UNNEST(v_quality_ids) qid
    ON CONFLICT ON CONSTRAINT model_qualities_pkey DO UPDATE
    SET active = true;

    INSERT INTO model_voices_junction (model_id, voice_id, active, created_at, generated, mcp)
    SELECT v_model_id, vid, true, NOW(), false, false
    FROM UNNEST(v_voice_ids) vid
    ON CONFLICT ON CONSTRAINT model_voices_pkey DO UPDATE
    SET active = true;

    -- Sync denormalized models_resource
    UPDATE models_resource r
    SET name = n.name,
        description = d.description,
        provider_id = v_provider_id,
        modality_ids = COALESCE((SELECT ARRAY_AGG(mm.modality_id) FROM model_modalities_junction mm WHERE mm.model_id = v_model_id AND mm.active = true), ARRAY[]::uuid[]),
        temperature_level_ids = COALESCE((SELECT ARRAY_AGG(mtl.temperature_level_id) FROM model_temperature_levels_junction mtl WHERE mtl.model_id = v_model_id AND mtl.active = true), ARRAY[]::uuid[]),
        reasoning_level_ids = COALESCE((SELECT ARRAY_AGG(mrl.reasoning_level_id) FROM model_reasoning_levels_junction mrl WHERE mrl.model_id = v_model_id AND mrl.active = true), ARRAY[]::uuid[]),
        quality_ids = COALESCE((SELECT ARRAY_AGG(mq.quality_id) FROM model_qualities_junction mq WHERE mq.model_id = v_model_id AND mq.active = true), ARRAY[]::uuid[]),
        voice_ids = COALESCE((SELECT ARRAY_AGG(mv.voice_id) FROM model_voices_junction mv WHERE mv.model_id = v_model_id AND mv.active = true), ARRAY[]::uuid[])
    FROM model_models_junction j
    LEFT JOIN names_resource n ON n.id = v_name_id
    LEFT JOIN descriptions_resource d ON d.id = v_description_id
    WHERE j.models_id = r.id
      AND j.model_id = v_model_id;

    RETURN QUERY SELECT v_model_id;
END;
$$;

