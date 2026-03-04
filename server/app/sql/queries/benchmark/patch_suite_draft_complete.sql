-- Patch benchmark bundle draft - accepts resource IDs and creates/updates draft
-- Creates draft if input_draft_id is NULL, updates if exists
-- Links resources via junction tables (9 multi-select resources)

DO $$
BEGIN
    DROP TYPE IF EXISTS types.benchmark_bundle_multi_resource_action CASCADE;
    CREATE TYPE types.benchmark_bundle_multi_resource_action AS (
        resource_ids uuid[],
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_patch_benchmark_bundle_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_benchmark_bundle_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_benchmark_bundle_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    departments types.benchmark_bundle_multi_resource_action DEFAULT NULL,
    models types.benchmark_bundle_multi_resource_action DEFAULT NULL,
    prompts types.benchmark_bundle_multi_resource_action DEFAULT NULL,
    instructions types.benchmark_bundle_multi_resource_action DEFAULT NULL,
    voices types.benchmark_bundle_multi_resource_action DEFAULT NULL,
    temperature_levels types.benchmark_bundle_multi_resource_action DEFAULT NULL,
    reasoning_levels types.benchmark_bundle_multi_resource_action DEFAULT NULL,
    tools types.benchmark_bundle_multi_resource_action DEFAULT NULL,
    keys types.benchmark_bundle_multi_resource_action DEFAULT NULL,
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
    v_group_id uuid;
    -- Resource IDs extracted from actions
    department_ids uuid[];
    model_ids uuid[];
    prompt_ids uuid[];
    instruction_ids uuid[];
    voice_ids uuid[];
    temperature_level_ids uuid[];
    reasoning_level_ids uuid[];
    tool_ids uuid[];
    key_ids uuid[];
    -- Tool-call logging
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Extract resource_ids from composite params
    department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    model_ids := COALESCE((models).resource_ids, ARRAY[]::uuid[]);
    prompt_ids := COALESCE((prompts).resource_ids, ARRAY[]::uuid[]);
    instruction_ids := COALESCE((instructions).resource_ids, ARRAY[]::uuid[]);
    voice_ids := COALESCE((voices).resource_ids, ARRAY[]::uuid[]);
    temperature_level_ids := COALESCE((temperature_levels).resource_ids, ARRAY[]::uuid[]);
    reasoning_level_ids := COALESCE((reasoning_levels).resource_ids, ARRAY[]::uuid[]);
    tool_ids := COALESCE((tools).resource_ids, ARRAY[]::uuid[]);
    key_ids := COALESCE((keys).resource_ids, ARRAY[]::uuid[]);

    -- Resolve profile_artifact.id to profiles_resource.id via junction table
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = v_profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profiles_resource linked to profile_artifact: %', v_profile_id;
    END IF;

    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        SELECT group_id INTO v_group_id FROM invocation_drafts_entry WHERE id = input_draft_id;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, session_id)
            VALUES (NOW(), (SELECT s.id FROM sessions_entry s JOIN profiles_sessions_connection psc ON psc.session_id = s.id WHERE psc.profiles_id = v_profile_id AND s.active = true ORDER BY s.created_at DESC LIMIT 1))
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE invocation_drafts_entry
        SET version = invocation_drafts_entry.version + 1,
            updated_at = now(),
            group_id = COALESCE(invocation_drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (SELECT 1 FROM invocation_drafts_profiles_connection pdj WHERE pdj.draft_id = invocation_drafts_entry.id AND pdj.profiles_id = v_profiles_resource_id)
          AND invocation_drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;

            -- Delete old resource links
            DELETE FROM invocation_drafts_departments_connection WHERE invocation_drafts_departments_connection.draft_id = v_draft_id;
            DELETE FROM invocation_drafts_models_connection WHERE invocation_drafts_models_connection.draft_id = v_draft_id;
            DELETE FROM invocation_drafts_prompts_connection WHERE invocation_drafts_prompts_connection.draft_id = v_draft_id;
            DELETE FROM invocation_drafts_instructions_connection WHERE invocation_drafts_instructions_connection.draft_id = v_draft_id;
            DELETE FROM invocation_drafts_voices_connection WHERE invocation_drafts_voices_connection.draft_id = v_draft_id;
            DELETE FROM invocation_drafts_temperature_levels_connection WHERE invocation_drafts_temperature_levels_connection.draft_id = v_draft_id;
            DELETE FROM invocation_drafts_reasoning_levels_connection WHERE invocation_drafts_reasoning_levels_connection.draft_id = v_draft_id;
            DELETE FROM invocation_drafts_tools_connection WHERE invocation_drafts_tools_connection.draft_id = v_draft_id;
            DELETE FROM invocation_drafts_keys_connection WHERE invocation_drafts_keys_connection.draft_id = v_draft_id;

            -- Insert new resource links
            IF department_ids IS NOT NULL THEN
                INSERT INTO invocation_drafts_departments_connection (draft_id, departments_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM unnest(department_ids) as dept_id
                ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF model_ids IS NOT NULL THEN
                INSERT INTO invocation_drafts_models_connection (draft_id, models_id, version)
                SELECT v_draft_id, m_id, v_new_version
                FROM unnest(model_ids) as m_id
                ON CONFLICT ON CONSTRAINT models_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF prompt_ids IS NOT NULL THEN
                INSERT INTO invocation_drafts_prompts_connection (draft_id, prompts_id, version)
                SELECT v_draft_id, p_id, v_new_version
                FROM unnest(prompt_ids) as p_id
                ON CONFLICT ON CONSTRAINT prompts_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF instruction_ids IS NOT NULL THEN
                INSERT INTO invocation_drafts_instructions_connection (draft_id, instructions_id, version)
                SELECT v_draft_id, i_id, v_new_version
                FROM unnest(instruction_ids) as i_id
                ON CONFLICT ON CONSTRAINT instructions_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF voice_ids IS NOT NULL THEN
                INSERT INTO invocation_drafts_voices_connection (draft_id, voices_id, version)
                SELECT v_draft_id, v_id, v_new_version
                FROM unnest(voice_ids) as v_id
                ON CONFLICT ON CONSTRAINT voices_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF temperature_level_ids IS NOT NULL THEN
                INSERT INTO invocation_drafts_temperature_levels_connection (draft_id, temperature_levels_id, version)
                SELECT v_draft_id, tl_id, v_new_version
                FROM unnest(temperature_level_ids) as tl_id
                ON CONFLICT ON CONSTRAINT temperature_levels_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF reasoning_level_ids IS NOT NULL THEN
                INSERT INTO invocation_drafts_reasoning_levels_connection (draft_id, reasoning_levels_id, version)
                SELECT v_draft_id, rl_id, v_new_version
                FROM unnest(reasoning_level_ids) as rl_id
                ON CONFLICT ON CONSTRAINT reasoning_levels_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF tool_ids IS NOT NULL THEN
                INSERT INTO invocation_drafts_tools_connection (draft_id, tools_id, version)
                SELECT v_draft_id, t_id, v_new_version
                FROM unnest(tool_ids) as t_id
                ON CONFLICT ON CONSTRAINT tools_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF key_ids IS NOT NULL THEN
                INSERT INTO invocation_drafts_keys_connection (draft_id, keys_id, version)
                SELECT v_draft_id, k_id, v_new_version
                FROM unnest(key_ids) as k_id
                ON CONFLICT ON CONSTRAINT keys_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;
        END IF;
    END IF;

    -- Create new draft if update failed or input_draft_id was NULL
    IF v_draft_id IS NULL THEN
        INSERT INTO groups_entry (created_at, session_id)
        VALUES (NOW(), (SELECT s.id FROM sessions_entry s JOIN profiles_sessions_connection psc ON psc.session_id = s.id WHERE psc.profiles_id = v_profile_id AND s.active = true ORDER BY s.created_at DESC LIMIT 1))
        RETURNING id INTO v_group_id;

        INSERT INTO invocation_drafts_entry (group_id)
        VALUES (v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

        INSERT INTO invocation_drafts_profiles_connection (draft_id, profiles_id, version)
        VALUES (v_draft_id, v_profiles_resource_id, v_new_version);

        v_draft_exists := false;

        -- Insert resource links for new draft
        IF department_ids IS NOT NULL THEN
            INSERT INTO invocation_drafts_departments_connection (draft_id, departments_id, version)
            SELECT v_draft_id, dept_id, v_new_version
            FROM unnest(department_ids) as dept_id
            ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF model_ids IS NOT NULL THEN
            INSERT INTO invocation_drafts_models_connection (draft_id, models_id, version)
            SELECT v_draft_id, m_id, v_new_version
            FROM unnest(model_ids) as m_id
            ON CONFLICT ON CONSTRAINT models_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF prompt_ids IS NOT NULL THEN
            INSERT INTO invocation_drafts_prompts_connection (draft_id, prompts_id, version)
            SELECT v_draft_id, p_id, v_new_version
            FROM unnest(prompt_ids) as p_id
            ON CONFLICT ON CONSTRAINT prompts_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF instruction_ids IS NOT NULL THEN
            INSERT INTO invocation_drafts_instructions_connection (draft_id, instructions_id, version)
            SELECT v_draft_id, i_id, v_new_version
            FROM unnest(instruction_ids) as i_id
            ON CONFLICT ON CONSTRAINT instructions_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF voice_ids IS NOT NULL THEN
            INSERT INTO invocation_drafts_voices_connection (draft_id, voices_id, version)
            SELECT v_draft_id, v_id, v_new_version
            FROM unnest(voice_ids) as v_id
            ON CONFLICT ON CONSTRAINT voices_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF temperature_level_ids IS NOT NULL THEN
            INSERT INTO invocation_drafts_temperature_levels_connection (draft_id, temperature_levels_id, version)
            SELECT v_draft_id, tl_id, v_new_version
            FROM unnest(temperature_level_ids) as tl_id
            ON CONFLICT ON CONSTRAINT temperature_levels_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF reasoning_level_ids IS NOT NULL THEN
            INSERT INTO invocation_drafts_reasoning_levels_connection (draft_id, reasoning_levels_id, version)
            SELECT v_draft_id, rl_id, v_new_version
            FROM unnest(reasoning_level_ids) as rl_id
            ON CONFLICT ON CONSTRAINT reasoning_levels_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF tool_ids IS NOT NULL THEN
            INSERT INTO invocation_drafts_tools_connection (draft_id, tools_id, version)
            SELECT v_draft_id, t_id, v_new_version
            FROM unnest(tool_ids) as t_id
            ON CONFLICT ON CONSTRAINT tools_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF key_ids IS NOT NULL THEN
            INSERT INTO invocation_drafts_keys_connection (draft_id, keys_id, version)
            SELECT v_draft_id, k_id, v_new_version
            FROM unnest(key_ids) as k_id
            ON CONFLICT ON CONSTRAINT keys_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;
    END IF;

    -- Tool call logging
    IF v_group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (
            id, group_id, created_at, updated_at
        ) VALUES (
            v_run_id, v_group_id, NOW(), NOW()
        );

        -- departments
        IF COALESCE(array_length(department_ids, 1), 0) > 0 THEN
            IF (departments).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_create_departments_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
                INSERT INTO departments_calls_connection (departments_id, call_id)
                SELECT x.department_id, v_call_id FROM UNNEST(department_ids) AS x(department_id);
            END IF;
            IF (departments).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_link_departments_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
                INSERT INTO departments_calls_connection (departments_id, call_id)
                SELECT x.department_id, v_call_id FROM UNNEST(department_ids) AS x(department_id);
            END IF;
        END IF;

        -- models
        IF COALESCE(array_length(model_ids, 1), 0) > 0 THEN
            IF (models).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_create_models_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((models).create_tool_id, v_call_id);
                INSERT INTO models_calls_connection (models_id, call_id)
                SELECT x.model_id, v_call_id FROM UNNEST(model_ids) AS x(model_id);
            END IF;
            IF (models).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_link_models_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((models).link_tool_id, v_call_id);
                INSERT INTO models_calls_connection (models_id, call_id)
                SELECT x.model_id, v_call_id FROM UNNEST(model_ids) AS x(model_id);
            END IF;
        END IF;

        -- prompts
        IF COALESCE(array_length(prompt_ids, 1), 0) > 0 THEN
            IF (prompts).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_create_prompts_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((prompts).create_tool_id, v_call_id);
                INSERT INTO prompts_calls_connection (prompts_id, call_id)
                SELECT x.prompt_id, v_call_id FROM UNNEST(prompt_ids) AS x(prompt_id);
            END IF;
            IF (prompts).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_link_prompts_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((prompts).link_tool_id, v_call_id);
                INSERT INTO prompts_calls_connection (prompts_id, call_id)
                SELECT x.prompt_id, v_call_id FROM UNNEST(prompt_ids) AS x(prompt_id);
            END IF;
        END IF;

        -- instructions
        IF COALESCE(array_length(instruction_ids, 1), 0) > 0 THEN
            IF (instructions).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_create_instructions_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((instructions).create_tool_id, v_call_id);
                INSERT INTO instructions_calls_connection (instructions_id, call_id)
                SELECT x.instruction_id, v_call_id FROM UNNEST(instruction_ids) AS x(instruction_id);
            END IF;
            IF (instructions).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_link_instructions_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((instructions).link_tool_id, v_call_id);
                INSERT INTO instructions_calls_connection (instructions_id, call_id)
                SELECT x.instruction_id, v_call_id FROM UNNEST(instruction_ids) AS x(instruction_id);
            END IF;
        END IF;

        -- voices
        IF COALESCE(array_length(voice_ids, 1), 0) > 0 THEN
            IF (voices).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_create_voices_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((voices).create_tool_id, v_call_id);
                INSERT INTO voices_calls_connection (voices_id, call_id)
                SELECT x.voice_id, v_call_id FROM UNNEST(voice_ids) AS x(voice_id);
            END IF;
            IF (voices).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_link_voices_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((voices).link_tool_id, v_call_id);
                INSERT INTO voices_calls_connection (voices_id, call_id)
                SELECT x.voice_id, v_call_id FROM UNNEST(voice_ids) AS x(voice_id);
            END IF;
        END IF;

        -- temperature_levels
        IF COALESCE(array_length(temperature_level_ids, 1), 0) > 0 THEN
            IF (temperature_levels).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_create_temperature_levels_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((temperature_levels).create_tool_id, v_call_id);
                INSERT INTO temperature_levels_calls_connection (temperature_levels_id, call_id)
                SELECT x.tl_id, v_call_id FROM UNNEST(temperature_level_ids) AS x(tl_id);
            END IF;
            IF (temperature_levels).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_link_temperature_levels_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((temperature_levels).link_tool_id, v_call_id);
                INSERT INTO temperature_levels_calls_connection (temperature_levels_id, call_id)
                SELECT x.tl_id, v_call_id FROM UNNEST(temperature_level_ids) AS x(tl_id);
            END IF;
        END IF;

        -- reasoning_levels
        IF COALESCE(array_length(reasoning_level_ids, 1), 0) > 0 THEN
            IF (reasoning_levels).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_create_reasoning_levels_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((reasoning_levels).create_tool_id, v_call_id);
                INSERT INTO reasoning_levels_calls_connection (reasoning_levels_id, call_id)
                SELECT x.rl_id, v_call_id FROM UNNEST(reasoning_level_ids) AS x(rl_id);
            END IF;
            IF (reasoning_levels).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_link_reasoning_levels_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((reasoning_levels).link_tool_id, v_call_id);
                INSERT INTO reasoning_levels_calls_connection (reasoning_levels_id, call_id)
                SELECT x.rl_id, v_call_id FROM UNNEST(reasoning_level_ids) AS x(rl_id);
            END IF;
        END IF;

        -- tools
        IF COALESCE(array_length(tool_ids, 1), 0) > 0 THEN
            IF (tools).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_create_tools_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((tools).create_tool_id, v_call_id);
                INSERT INTO tools_calls_connection (tools_id, call_id)
                SELECT x.tool_id, v_call_id FROM UNNEST(tool_ids) AS x(tool_id);
            END IF;
            IF (tools).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_link_tools_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((tools).link_tool_id, v_call_id);
                INSERT INTO tools_calls_connection (tools_id, call_id)
                SELECT x.tool_id, v_call_id FROM UNNEST(tool_ids) AS x(tool_id);
            END IF;
        END IF;

        -- keys
        IF COALESCE(array_length(key_ids, 1), 0) > 0 THEN
            IF (keys).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_create_keys_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((keys).create_tool_id, v_call_id);
                INSERT INTO keys_calls_connection (keys_id, call_id)
                SELECT x.key_id, v_call_id FROM UNNEST(key_ids) AS x(key_id);
            END IF;
            IF (keys).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'benchmark_draft_link_keys_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((keys).link_tool_id, v_call_id);
                INSERT INTO keys_calls_connection (keys_id, call_id)
                SELECT x.key_id, v_call_id FROM UNNEST(key_ids) AS x(key_id);
            END IF;
        END IF;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END $$;
