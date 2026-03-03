-- Patch model draft - accepts nested resource action composites.
-- Creates draft if input_draft_id is NULL, updates if exists.

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
    voices types.model_multi_resource_action DEFAULT NULL,
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
    v_profiles_resource_id uuid;
    v_group_id uuid := group_id;

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

    -- Tool-call logging
    v_run_id uuid;
    v_call_id uuid;
BEGIN
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

    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = v_profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profiles_resource linked to profile_artifact: %', v_profile_id;
    END IF;

    -- Validate IDs
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

    -- Try update path first
    IF input_draft_id IS NOT NULL THEN
        SELECT vde.group_id INTO v_group_id
        FROM model_drafts_entry vde
        WHERE vde.id = input_draft_id;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (SELECT id FROM sessions_entry
                 WHERE sessions_entry.profile_id = v_profile_id
                   AND sessions_entry.active = true
                 ORDER BY created_at DESC
                 LIMIT 1)
            )
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE model_drafts_entry
        SET version = model_drafts_entry.version + 1,
            updated_at = NOW(),
            group_id = COALESCE(model_drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (
              SELECT 1
              FROM model_drafts_profiles_connection pdc
              WHERE pdc.draft_id = model_drafts_entry.id
                AND pdc.profiles_id = v_profiles_resource_id
          )
          AND model_drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
        END IF;
    END IF;

    -- Create path (new draft or failed optimistic update)
    IF v_draft_id IS NULL THEN
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (SELECT id FROM sessions_entry
                 WHERE sessions_entry.profile_id = v_profile_id
                   AND sessions_entry.active = true
                 ORDER BY created_at DESC
                 LIMIT 1)
            )
            RETURNING id INTO v_group_id;
        END IF;

        INSERT INTO model_drafts_entry (group_id)
        VALUES (v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

        INSERT INTO model_drafts_profiles_connection (draft_id, profiles_id, version)
        VALUES (v_draft_id, v_profiles_resource_id, v_new_version);
    END IF;

    -- Replace draft links
    DELETE FROM model_drafts_names_connection WHERE draft_id = v_draft_id;
    DELETE FROM model_drafts_descriptions_connection WHERE draft_id = v_draft_id;
    DELETE FROM model_drafts_values_connection WHERE draft_id = v_draft_id;
    DELETE FROM model_drafts_providers_connection WHERE draft_id = v_draft_id;
    DELETE FROM model_drafts_flags_connection WHERE draft_id = v_draft_id;
    DELETE FROM model_drafts_departments_connection WHERE draft_id = v_draft_id;
    DELETE FROM model_drafts_modalities_connection WHERE draft_id = v_draft_id;
    DELETE FROM model_drafts_temperature_levels_connection WHERE draft_id = v_draft_id;
    DELETE FROM model_drafts_pricing_connection WHERE draft_id = v_draft_id;
    DELETE FROM model_drafts_reasoning_levels_connection WHERE draft_id = v_draft_id;
    DELETE FROM model_drafts_qualities_connection WHERE draft_id = v_draft_id;
    DELETE FROM model_drafts_voices_connection WHERE draft_id = v_draft_id;

    IF v_name_id IS NOT NULL THEN
        INSERT INTO model_drafts_names_connection (draft_id, names_id, version)
        VALUES (v_draft_id, v_name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO model_drafts_descriptions_connection (draft_id, descriptions_id, version)
        VALUES (v_draft_id, v_description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_value_id IS NOT NULL THEN
        INSERT INTO model_drafts_values_connection (draft_id, values_id, version)
        VALUES (v_draft_id, v_value_id, v_new_version)
        ON CONFLICT ON CONSTRAINT values_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_provider_id IS NOT NULL THEN
        INSERT INTO model_drafts_providers_connection (draft_id, providers_id, version)
        VALUES (v_draft_id, v_provider_id, v_new_version)
        ON CONFLICT ON CONSTRAINT providers_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    INSERT INTO model_drafts_flags_connection (draft_id, flags_id, version)
    SELECT v_draft_id, fid, v_new_version
    FROM UNNEST(v_flag_ids) fid
    ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO model_drafts_departments_connection (draft_id, departments_id, version)
    SELECT v_draft_id, did, v_new_version
    FROM UNNEST(v_department_ids) did
    ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO model_drafts_modalities_connection (draft_id, modalities_id, version)
    SELECT v_draft_id, mid, v_new_version
    FROM UNNEST(v_modality_ids) mid
    ON CONFLICT ON CONSTRAINT modalities_draft_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO model_drafts_temperature_levels_connection (draft_id, temperature_levels_id, version)
    SELECT v_draft_id, tid, v_new_version
    FROM UNNEST(v_temperature_level_ids) tid
    ON CONFLICT ON CONSTRAINT temperature_levels_draft_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO model_drafts_pricing_connection (draft_id, pricing_id, version)
    SELECT v_draft_id, pid, v_new_version
    FROM UNNEST(v_pricing_ids) pid
    ON CONFLICT ON CONSTRAINT pricing_draft_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO model_drafts_reasoning_levels_connection (draft_id, reasoning_levels_id, version)
    SELECT v_draft_id, rid, v_new_version
    FROM UNNEST(v_reasoning_level_ids) rid
    ON CONFLICT ON CONSTRAINT reasoning_levels_draft_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO model_drafts_qualities_connection (draft_id, qualities_id, version)
    SELECT v_draft_id, qid, v_new_version
    FROM UNNEST(v_quality_ids) qid
    ON CONFLICT ON CONSTRAINT qualities_draft_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO model_drafts_voices_connection (draft_id, voices_id, version)
    SELECT v_draft_id, vid, v_new_version
    FROM UNNEST(v_voice_ids) vid
    ON CONFLICT ON CONSTRAINT voices_draft_pkey DO UPDATE SET version = v_new_version;

    -- Tool-call tracking: one run per draft patch
    IF v_group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, v_group_id, NOW(), NOW());

        IF v_name_id IS NOT NULL THEN
            IF (names).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_create_names_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
                INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
            END IF;
            IF (names).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_link_names_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
                INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
            END IF;
        END IF;

        IF v_description_id IS NOT NULL THEN
            IF (descriptions).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_create_descriptions_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
                INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
            END IF;
            IF (descriptions).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_link_descriptions_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
                INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
            END IF;
        END IF;

        IF v_value_id IS NOT NULL THEN
            IF ("values").create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_create_values_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (("values").create_tool_id, v_call_id);
                INSERT INTO values_calls_connection (values_id, call_id) VALUES (v_value_id, v_call_id);
            END IF;
            IF ("values").link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_link_values_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (("values").link_tool_id, v_call_id);
                INSERT INTO values_calls_connection (values_id, call_id) VALUES (v_value_id, v_call_id);
            END IF;
        END IF;

        IF v_provider_id IS NOT NULL THEN
            IF (providers).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_create_providers_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((providers).create_tool_id, v_call_id);
                INSERT INTO providers_calls_connection (providers_id, call_id) VALUES (v_provider_id, v_call_id);
            END IF;
            IF (providers).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_link_providers_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((providers).link_tool_id, v_call_id);
                INSERT INTO providers_calls_connection (providers_id, call_id) VALUES (v_provider_id, v_call_id);
            END IF;
        END IF;

        IF COALESCE(array_length(v_flag_ids, 1), 0) > 0 THEN
            IF (flags).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_create_flags_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
                INSERT INTO flags_calls_connection (flags_id, call_id)
                SELECT fid, v_call_id FROM UNNEST(v_flag_ids) fid;
            END IF;
            IF (flags).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_link_flags_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
                INSERT INTO flags_calls_connection (flags_id, call_id)
                SELECT fid, v_call_id FROM UNNEST(v_flag_ids) fid;
            END IF;
        END IF;

        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
            IF (departments).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_create_departments_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
                INSERT INTO departments_calls_connection (departments_id, call_id)
                SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
            END IF;
            IF (departments).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_link_departments_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
                INSERT INTO departments_calls_connection (departments_id, call_id)
                SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
            END IF;
        END IF;

        IF COALESCE(array_length(v_modality_ids, 1), 0) > 0 THEN
            IF (modalities).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_create_modalities_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((modalities).create_tool_id, v_call_id);
                INSERT INTO modalities_calls_connection (modalities_id, call_id)
                SELECT mid, v_call_id FROM UNNEST(v_modality_ids) mid;
            END IF;
            IF (modalities).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_link_modalities_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((modalities).link_tool_id, v_call_id);
                INSERT INTO modalities_calls_connection (modalities_id, call_id)
                SELECT mid, v_call_id FROM UNNEST(v_modality_ids) mid;
            END IF;
        END IF;

        IF COALESCE(array_length(v_temperature_level_ids, 1), 0) > 0 THEN
            IF (temperature_levels).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_create_temperature_levels_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((temperature_levels).create_tool_id, v_call_id);
                INSERT INTO temperature_levels_calls_connection (temperature_levels_id, call_id)
                SELECT tid, v_call_id FROM UNNEST(v_temperature_level_ids) tid;
            END IF;
            IF (temperature_levels).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_link_temperature_levels_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((temperature_levels).link_tool_id, v_call_id);
                INSERT INTO temperature_levels_calls_connection (temperature_levels_id, call_id)
                SELECT tid, v_call_id FROM UNNEST(v_temperature_level_ids) tid;
            END IF;
        END IF;

        IF COALESCE(array_length(v_pricing_ids, 1), 0) > 0 THEN
            IF (pricing).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_create_pricing_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((pricing).create_tool_id, v_call_id);
                INSERT INTO pricing_calls_connection (pricing_id, call_id)
                SELECT pid, v_call_id FROM UNNEST(v_pricing_ids) pid;
            END IF;
            IF (pricing).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_link_pricing_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((pricing).link_tool_id, v_call_id);
                INSERT INTO pricing_calls_connection (pricing_id, call_id)
                SELECT pid, v_call_id FROM UNNEST(v_pricing_ids) pid;
            END IF;
        END IF;

        IF COALESCE(array_length(v_reasoning_level_ids, 1), 0) > 0 THEN
            IF (reasoning_levels).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_create_reasoning_levels_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((reasoning_levels).create_tool_id, v_call_id);
                INSERT INTO reasoning_levels_calls_connection (reasoning_levels_id, call_id)
                SELECT rid, v_call_id FROM UNNEST(v_reasoning_level_ids) rid;
            END IF;
            IF (reasoning_levels).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_link_reasoning_levels_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((reasoning_levels).link_tool_id, v_call_id);
                INSERT INTO reasoning_levels_calls_connection (reasoning_levels_id, call_id)
                SELECT rid, v_call_id FROM UNNEST(v_reasoning_level_ids) rid;
            END IF;
        END IF;

        IF COALESCE(array_length(v_quality_ids, 1), 0) > 0 THEN
            IF (qualities).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_create_qualities_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((qualities).create_tool_id, v_call_id);
                INSERT INTO qualities_calls_connection (qualities_id, call_id)
                SELECT qid, v_call_id FROM UNNEST(v_quality_ids) qid;
            END IF;
            IF (qualities).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_link_qualities_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((qualities).link_tool_id, v_call_id);
                INSERT INTO qualities_calls_connection (qualities_id, call_id)
                SELECT qid, v_call_id FROM UNNEST(v_quality_ids) qid;
            END IF;
        END IF;

        IF COALESCE(array_length(v_voice_ids, 1), 0) > 0 THEN
            IF (voices).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_create_voices_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((voices).create_tool_id, v_call_id);
                INSERT INTO voices_calls_connection (voices_id, call_id)
                SELECT vid, v_call_id FROM UNNEST(v_voice_ids) vid;
            END IF;
            IF (voices).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'model_draft_link_voices_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((voices).link_tool_id, v_call_id);
                INSERT INTO voices_calls_connection (voices_id, call_id)
                SELECT vid, v_call_id FROM UNNEST(v_voice_ids) vid;
            END IF;
        END IF;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
