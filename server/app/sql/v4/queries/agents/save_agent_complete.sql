-- Unified save agent function - handles both create (agent_id = NULL) and update (agent_id provided)
-- Follows persona save pattern with composite resource action types

-- 0) Drop and recreate composite types for resource actions
DO $$
BEGIN
    DROP TYPE IF EXISTS types.agent_resource_action CASCADE;
    CREATE TYPE types.agent_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.agent_multi_resource_action CASCADE;
    CREATE TYPE types.agent_multi_resource_action AS (
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
        WHERE proname = 'api_save_agent_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_agent_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function with composite resource action parameters
CREATE OR REPLACE FUNCTION api_save_agent_v4(
    profile_id uuid,
    input_agent_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.agent_resource_action DEFAULT NULL,
    descriptions types.agent_resource_action DEFAULT NULL,
    models types.agent_resource_action DEFAULT NULL,
    prompts types.agent_resource_action DEFAULT NULL,
    instructions types.agent_resource_action DEFAULT NULL,
    flags types.agent_resource_action DEFAULT NULL,
    temperature_levels types.agent_resource_action DEFAULT NULL,
    reasoning_levels types.agent_resource_action DEFAULT NULL,
    departments types.agent_multi_resource_action DEFAULT NULL,
    tools types.agent_multi_resource_action DEFAULT NULL,
    voices types.agent_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    agent_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_agent_id uuid;
    v_profile_id uuid;
    v_input_agent_id uuid;
    is_create boolean;
    v_name_id uuid;
    v_description_id uuid;
    v_model_id uuid;
    v_prompt_id uuid;
    v_instructions_id uuid;
    v_active_flag_id uuid;
    v_temperature_level_id uuid;
    v_reasoning_level_id uuid;
    v_department_ids uuid[];
    v_tool_ids uuid[];
    v_voice_ids uuid[];
    -- Call tracking variables
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Assign parameters to local variables (extract from composites)
    v_profile_id := profile_id;
    v_input_agent_id := input_agent_id;
    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_model_id := (models).resource_id;
    v_prompt_id := (prompts).resource_id;
    v_instructions_id := (instructions).resource_id;
    v_active_flag_id := (flags).resource_id;
    v_temperature_level_id := (temperature_levels).resource_id;
    v_reasoning_level_id := (reasoning_levels).resource_id;
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_tool_ids := COALESCE((tools).resource_ids, ARRAY[]::uuid[]);
    v_voice_ids := COALESCE((voices).resource_ids, ARRAY[]::uuid[]);

    -- Validate required fields
    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    IF v_model_id IS NULL THEN
        RAISE EXCEPTION 'Model resource is required';
    END IF;

    -- Determine if create or update
    is_create := (v_input_agent_id IS NULL);

    -- Create or UPDATE agent_artifact first (outside CTE)
    IF is_create THEN
        INSERT INTO agent_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_agent_id;
    ELSE
        v_agent_id := v_input_agent_id;
        UPDATE agent_artifact
        SET updated_at = NOW()
        WHERE id = v_agent_id;
    END IF;

    -- Validate resource IDs exist
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_model_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM model_artifact WHERE id = v_model_id) THEN
        RAISE EXCEPTION 'Model not found: %', v_model_id;
    END IF;

    IF v_prompt_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM prompts_resource WHERE id = v_prompt_id) THEN
        RAISE EXCEPTION 'Prompt resource not found: %', v_prompt_id;
    END IF;

    IF v_instructions_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM instructions_resource WHERE id = v_instructions_id) THEN
        RAISE EXCEPTION 'Instructions resource not found: %', v_instructions_id;
    END IF;

    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    IF v_temperature_level_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM temperature_levels_resource WHERE id = v_temperature_level_id) THEN
        RAISE EXCEPTION 'Temperature level not found: %', v_temperature_level_id;
    END IF;

    IF v_reasoning_level_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM reasoning_levels_resource WHERE id = v_reasoning_level_id) THEN
        RAISE EXCEPTION 'Reasoning level not found: %', v_reasoning_level_id;
    END IF;

    -- Conditional: For update, remove old links first
    IF NOT is_create THEN
        DELETE FROM agent_names_junction WHERE agent_id = v_agent_id;
        DELETE FROM agent_descriptions_junction WHERE agent_id = v_agent_id;
        DELETE FROM agent_departments_junction WHERE agent_id = v_agent_id;
        DELETE FROM agent_instructions_junction WHERE agent_id = v_agent_id;
        DELETE FROM agent_tools_junction WHERE agent_id = v_agent_id;
        -- Update existing active flag if it exists
        UPDATE agent_flags_junction SET
            flag_id = COALESCE(v_active_flag_id, agent_flags_junction.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE agent_id = v_agent_id;
        -- Deactivate existing temperature/reasoning/voice links
        UPDATE agent_temperature_levels_junction SET active = false WHERE agent_id = v_agent_id;
        UPDATE agent_reasoning_levels_junction SET active = false WHERE agent_id = v_agent_id;
        UPDATE agent_voices_junction SET active = false WHERE agent_id = v_agent_id;
    END IF;

    -- === TOOL CALL TRACKING ===
    -- Create single run for the group if any tool IDs present
    IF group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
        VALUES (v_run_id, 0, 0, 0, group_id, NOW(), NOW());
    END IF;

    -- names
    IF v_run_id IS NOT NULL AND v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    -- descriptions
    IF v_run_id IS NOT NULL AND v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    -- models
    IF v_run_id IS NOT NULL AND v_model_id IS NOT NULL THEN
        IF (models).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_create_models_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((models).create_tool_id, v_call_id);
            INSERT INTO models_calls_connection (models_id, call_id) VALUES (v_model_id, v_call_id);
        END IF;
        IF (models).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_link_models_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((models).link_tool_id, v_call_id);
            INSERT INTO models_calls_connection (models_id, call_id) VALUES (v_model_id, v_call_id);
        END IF;
    END IF;

    -- prompts
    IF v_run_id IS NOT NULL AND v_prompt_id IS NOT NULL THEN
        IF (prompts).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_create_prompts_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((prompts).create_tool_id, v_call_id);
            INSERT INTO prompts_calls_connection (prompts_id, call_id) VALUES (v_prompt_id, v_call_id);
        END IF;
        IF (prompts).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_link_prompts_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((prompts).link_tool_id, v_call_id);
            INSERT INTO prompts_calls_connection (prompts_id, call_id) VALUES (v_prompt_id, v_call_id);
        END IF;
    END IF;

    -- instructions
    IF v_run_id IS NOT NULL AND v_instructions_id IS NOT NULL THEN
        IF (instructions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_create_instructions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((instructions).create_tool_id, v_call_id);
            INSERT INTO instructions_calls_connection (instructions_id, call_id) VALUES (v_instructions_id, v_call_id);
        END IF;
        IF (instructions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_link_instructions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((instructions).link_tool_id, v_call_id);
            INSERT INTO instructions_calls_connection (instructions_id, call_id) VALUES (v_instructions_id, v_call_id);
        END IF;
    END IF;

    -- flags
    IF v_run_id IS NOT NULL AND v_active_flag_id IS NOT NULL THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
    END IF;

    -- temperature_levels
    IF v_run_id IS NOT NULL AND v_temperature_level_id IS NOT NULL THEN
        IF (temperature_levels).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_create_temperature_levels_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((temperature_levels).create_tool_id, v_call_id);
            INSERT INTO temperature_levels_calls_connection (temperature_levels_id, call_id) VALUES (v_temperature_level_id, v_call_id);
        END IF;
        IF (temperature_levels).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_link_temperature_levels_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((temperature_levels).link_tool_id, v_call_id);
            INSERT INTO temperature_levels_calls_connection (temperature_levels_id, call_id) VALUES (v_temperature_level_id, v_call_id);
        END IF;
    END IF;

    -- reasoning_levels
    IF v_run_id IS NOT NULL AND v_reasoning_level_id IS NOT NULL THEN
        IF (reasoning_levels).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_create_reasoning_levels_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((reasoning_levels).create_tool_id, v_call_id);
            INSERT INTO reasoning_levels_calls_connection (reasoning_levels_id, call_id) VALUES (v_reasoning_level_id, v_call_id);
        END IF;
        IF (reasoning_levels).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_link_reasoning_levels_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((reasoning_levels).link_tool_id, v_call_id);
            INSERT INTO reasoning_levels_calls_connection (reasoning_levels_id, call_id) VALUES (v_reasoning_level_id, v_call_id);
        END IF;
    END IF;

    -- departments (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
        END IF;
        IF (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
        END IF;
    END IF;

    -- tools (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_tool_ids, 1), 0) > 0 THEN
        IF (tools).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_create_tools_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((tools).create_tool_id, v_call_id);
            INSERT INTO tools_calls_connection (tools_id, call_id)
            SELECT tool_id, v_call_id FROM UNNEST(v_tool_ids) AS tool_id;
        END IF;
        IF (tools).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_link_tools_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((tools).link_tool_id, v_call_id);
            INSERT INTO tools_calls_connection (tools_id, call_id)
            SELECT tool_id, v_call_id FROM UNNEST(v_tool_ids) AS tool_id;
        END IF;
    END IF;

    -- voices (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_voice_ids, 1), 0) > 0 THEN
        IF (voices).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_create_voices_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((voices).create_tool_id, v_call_id);
            INSERT INTO voices_calls_connection (voices_id, call_id)
            SELECT voice_id, v_call_id FROM UNNEST(v_voice_ids) AS voice_id;
        END IF;
        IF (voices).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'agent_link_voices_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((voices).link_tool_id, v_call_id);
            INSERT INTO voices_calls_connection (voices_id, call_id)
            SELECT voice_id, v_call_id FROM UNNEST(v_voice_ids) AS voice_id;
        END IF;
    END IF;

    -- Continue with agent save using SQL (agent already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_agent_id AS agent_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_model_id AS model_id,
            v_prompt_id AS prompt_id,
            v_instructions_id AS instructions_id,
            v_active_flag_id AS active_flag_id,
            v_temperature_level_id AS temperature_level_id,
            v_reasoning_level_id AS reasoning_level_id,
            v_department_ids AS department_ids,
            v_tool_ids AS tool_ids,
            v_voice_ids AS voice_ids
    ),
    -- Link agent to name
    link_agent_name AS (
        INSERT INTO agent_names_junction (agent_id, name_id, created_at)
        SELECT
            x.agent_id,
            x.name_id,
            NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT (agent_id, name_id) DO NOTHING
    ),
    -- Link agent to description
    link_agent_description AS (
        INSERT INTO agent_descriptions_junction (agent_id, description_id, created_at)
        SELECT
            x.agent_id,
            x.description_id,
            NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT (agent_id, description_id) DO NOTHING
    ),
    -- Link agent to model (remove old links first for update)
    remove_old_model AS (
        DELETE FROM agent_models_junction
        WHERE agent_id = (SELECT agent_id FROM params)
          AND model_id != (SELECT model_id FROM params)
    ),
    link_agent_model AS (
        INSERT INTO agent_models_junction (agent_id, model_id, created_at)
        SELECT
            x.agent_id,
            x.model_id,
            NOW()
        FROM params x
        WHERE x.model_id IS NOT NULL
        ON CONFLICT (agent_id, model_id) DO NOTHING
    ),
    -- Remove old prompt links for update
    remove_old_prompts AS (
        DELETE FROM agent_prompts_junction
        WHERE agent_id = (SELECT agent_id FROM params)
    ),
    -- Link agent to prompt
    link_prompt AS (
        INSERT INTO agent_prompts_junction (agent_id, prompt_id, active, created_at)
        SELECT
            x.agent_id,
            x.prompt_id,
            true,
            NOW()
        FROM params x
        WHERE x.prompt_id IS NOT NULL
        ON CONFLICT (agent_id, prompt_id) DO UPDATE SET
            active = true
    ),
    -- Link agent to instructions
    link_agent_instructions AS (
        INSERT INTO agent_instructions_junction (agent_id, instruction_id, created_at)
        SELECT
            x.agent_id,
            x.instructions_id,
            NOW()
        FROM params x
        WHERE x.instructions_id IS NOT NULL
        ON CONFLICT (agent_id, instruction_id) DO NOTHING
    ),
    -- Insert or UPDATE agent_artifact active flag
    insert_agent_active_flag AS (
        INSERT INTO agent_flags_junction (agent_id, flag_id, value, created_at) SELECT x.agent_id,
            COALESCE(x.active_flag_id, f.id),
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'agent_active'
        ON CONFLICT (agent_id, flag_id, type) DO UPDATE SET
            flag_id = COALESCE(EXCLUDED.flag_id, agent_flags_junction.flag_id),
            value = EXCLUDED.value
    ),
    -- Link departments (old ones already deleted above if update)
    link_departments AS (
        INSERT INTO agent_departments_junction (agent_id, department_id, active, created_at)
        SELECT
            x.agent_id,
            dept_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT (agent_id, department_id) DO UPDATE SET
            active = true
    ),
    -- Link temperature level if provided
    link_temperature_level AS (
        INSERT INTO agent_temperature_levels_junction (agent_id, temperature_level_id, active, created_at)
        SELECT
            x.agent_id,
            x.temperature_level_id,
            true,
            NOW()
        FROM params x
        WHERE x.temperature_level_id IS NOT NULL
        ON CONFLICT (agent_id, temperature_level_id) DO UPDATE SET
            active = true
    ),
    -- Link reasoning level if provided
    link_reasoning_level AS (
        INSERT INTO agent_reasoning_levels_junction (agent_id, reasoning_level_id, active, created_at)
        SELECT
            x.agent_id,
            x.reasoning_level_id,
            true,
            NOW()
        FROM params x
        WHERE x.reasoning_level_id IS NOT NULL
        ON CONFLICT (agent_id, reasoning_level_id) DO UPDATE SET
            active = true
    ),
    -- Link voices if provided
    link_voices AS (
        INSERT INTO agent_voices_junction (agent_id, voice_id, active, created_at)
        SELECT
            x.agent_id,
            voice_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN UNNEST(x.voice_ids) as voice_id
        WHERE COALESCE(array_length(x.voice_ids, 1), 0) > 0
        ON CONFLICT (agent_id, voice_id) DO UPDATE SET
            active = true
    ),
    -- Create tools_resource entries for provided tool_ids (tool_ids here are tool_artifact IDs)
    create_tool_resources AS (
        INSERT INTO tools_resource (tool_id, active, created_at)
        SELECT DISTINCT tool_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.tool_ids) as tool_id
        WHERE COALESCE(array_length(x.tool_ids, 1), 0) > 0
          AND EXISTS (SELECT 1 FROM tool_artifact t WHERE t.id = tool_id)
        ON CONFLICT (tool_id) DO UPDATE SET active = EXCLUDED.active
        RETURNING id, tool_id
    ),
    -- Link tools if provided
    link_tools AS (
        INSERT INTO agent_tools_junction (agent_id, tool_id, active, created_at)
        SELECT
            x.agent_id,
            ctr.id,
            true,
            NOW()
        FROM params x
        CROSS JOIN create_tool_resources ctr
        WHERE COALESCE(array_length(x.tool_ids, 1), 0) > 0
        ON CONFLICT (agent_id, tool_id) DO UPDATE SET
            active = true
    ),
    -- Sync linked resources with name/description
    sync_artifact_resources AS (
        UPDATE agents_resource r
        SET name = n.name,
            description = d.description
        FROM agent_agents_junction j
        CROSS JOIN params p
        LEFT JOIN names_resource n ON n.id = p.name_id
        LEFT JOIN descriptions_resource d ON d.id = p.description_id
        WHERE j.agents_id = r.id
          AND j.agent_id = p.agent_id
        RETURNING r.id
    )
    SELECT
        x.agent_id AS agent_id
    FROM params x;
END;
$$;
