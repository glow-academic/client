-- Unified save agent function - handles both create (agent_id = NULL) and update (agent_id provided)
-- Converted to function
-- Follows personas save pattern
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
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

CREATE OR REPLACE FUNCTION api_save_agent_v4(
    name text,
    model_id uuid,
    profile_id uuid,
    description text DEFAULT NULL,
    prompt_id uuid DEFAULT NULL,
    system_prompt text DEFAULT NULL,
    instructions_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    artifact_name text DEFAULT 'assistant',
    input_agent_id uuid DEFAULT NULL,
    temperature_level_id uuid DEFAULT NULL,
    reasoning_level_id uuid DEFAULT NULL,
    voice_ids uuid[] DEFAULT ARRAY[]::uuid[],
    tool_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    agent_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_agent_id uuid;
    is_create boolean;
BEGIN
    -- Determine if create or update
    is_create := (input_agent_id IS NULL);
    
    -- Create or UPDATE agent_artifact first (outside CTE)
    IF is_create THEN
        -- CREATE path
        INSERT INTO agent_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_agent_id;
    ELSE
        -- UPDATE path
        v_agent_id := input_agent_id;
        UPDATE agent_artifact
        SET updated_at = NOW()
        WHERE id = v_agent_id;
    END IF;
    
    -- Validate required fields (name is required, description is optional)
    IF name IS NULL OR name = '' THEN
        RAISE EXCEPTION 'Name is required';
    END IF;
    
    IF model_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM model_artifact WHERE id = model_id) THEN
        RAISE EXCEPTION 'Model not found: %', model_id;
    END IF;
    
    IF prompt_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM prompts_resource WHERE id = prompt_id) THEN
        RAISE EXCEPTION 'Prompt resource not found: %', prompt_id;
    END IF;
    
    IF instructions_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM instructions_resource WHERE id = instructions_id) THEN
        RAISE EXCEPTION 'Instructions resource not found: %', instructions_id;
    END IF;
    
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;
    
    IF temperature_level_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM temperature_levels_resource WHERE id = temperature_level_id) THEN
        RAISE EXCEPTION 'Temperature level not found: %', temperature_level_id;
    END IF;
    
    IF reasoning_level_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM reasoning_levels_resource WHERE id = reasoning_level_id) THEN
        RAISE EXCEPTION 'Reasoning level not found: %', reasoning_level_id;
    END IF;
    
    -- Conditional: For update, remove old links first (outside CTE since we need PL/pgSQL variable)
    IF NOT is_create THEN
        DELETE FROM agent_names_junction WHERE agent_id = v_agent_id;
        DELETE FROM agent_descriptions_junction WHERE agent_id = v_agent_id;
        DELETE FROM agent_departments_junction WHERE agent_id = v_agent_id;
        DELETE FROM agent_instructions_junction WHERE agent_id = v_agent_id;
        DELETE FROM agent_tools_junction WHERE agent_id = v_agent_id;
        -- Update existing active flag if it exists
        UPDATE agent_flags_junction SET
            flag_id = COALESCE(api_save_agent_v4.active_flag_id, agent_flags_junction.flag_id),
            value = CASE WHEN api_save_agent_v4.active_flag_id IS NOT NULL THEN true ELSE false END
        WHERE agent_id = v_agent_id
          ;
        -- Deactivate existing temperature/reasoning/voice links
        UPDATE agent_temperature_levels_junction SET active = false WHERE agent_id = v_agent_id;
        UPDATE agent_reasoning_levels_junction SET active = false WHERE agent_id = v_agent_id;
        UPDATE agent_voices_junction SET active = false WHERE agent_id = v_agent_id;
    END IF;
    
    -- Continue with agent save using SQL (agent already created/updated above)
    RETURN QUERY
    WITH params AS (
        SELECT
            v_agent_id AS agent_id,
            name AS name,
            description AS description,
            model_id,
            prompt_id,
            NULLIF(system_prompt, '') AS system_prompt,
            instructions_id,
            active_flag_id,
            COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
            profile_id,
            artifact_name,
            temperature_level_id,
            reasoning_level_id,
            COALESCE(voice_ids, ARRAY[]::uuid[]) AS voice_ids,
            COALESCE(tool_ids, ARRAY[]::uuid[]) AS tool_ids
    ),
    -- Insert/update name in names table
    name_resource AS (
        INSERT INTO names_resource (name, created_at)
        SELECT name, NOW()
        FROM params
        WHERE name IS NOT NULL AND name != ''
        ON CONFLICT (name) DO UPDATE SET created_at = EXCLUDED.created_at
        RETURNING id as name_id
    ),
    -- Insert/update description in descriptions table
    description_resource AS (
        INSERT INTO descriptions_resource (description, created_at)
        SELECT description, NOW()
        WHERE profile_id = (SELECT profile_id FROM params)
    ),
    -- Conditional: Validate permissions based on operation
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM agent_departments_junction
        WHERE agent_departments_junction.agent_id = (SELECT p.agent_id FROM params p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT 
            CASE 
                WHEN (SELECT p.agent_id FROM params p) IS NULL THEN
                    -- Validate create permissions
                    (SELECT validate_department_create_permissions(
                        up.role::text,
                        x.department_ids::text[]
                    ) FROM params x CROSS JOIN user_profile up)
                ELSE
                    -- Validate update permissions
                    (SELECT validate_department_update_permissions(
                        up.role::text,
                        ocd.department_ids,
                        ud.department_ids
                    ) FROM user_profile up
                    CROSS JOIN object_current_departments ocd
                    CROSS JOIN user_departments ud)
            END as validation_passed
    ),
    -- Link agent to name
    link_agent_name AS (
        INSERT INTO agent_names_junction (agent_id, name_id, created_at)
        SELECT 
            x.agent_id,
            nr.name_id,
            NOW()
        FROM params x
        CROSS JOIN name_resource nr
        ON CONFLICT (agent_id, name_id) DO NOTHING
    ),
    -- Link agent to description
    link_agent_description AS (
        INSERT INTO agent_descriptions_junction (agent_id, description_id, created_at)
        SELECT 
            x.agent_id,
            dr.description_id,
            NOW()
        FROM params x
        CROSS JOIN description_resource dr
        WHERE dr.description_id IS NOT NULL
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
    -- Handle prompt (create new if system_prompt provided and prompt_id not provided)
    new_prompt AS (
        -- Create prompt only if system_prompt provided and prompt_id not provided
        INSERT INTO prompts_resource (system_prompt, created_at)
        SELECT x.system_prompt, NOW()
        FROM params x
        WHERE x.prompt_id IS NULL AND x.system_prompt IS NOT NULL AND x.system_prompt != ''
        RETURNING id::uuid as prompt_id
    ),
    selected_prompt_id AS (
        -- Use provided prompt_id or newly created prompt_id (only return row if prompt exists)
        SELECT COALESCE(
            x.prompt_id,
            (SELECT prompt_id FROM new_prompt LIMIT 1)
        ) as prompt_id
        FROM params x
        WHERE x.prompt_id IS NOT NULL OR EXISTS (SELECT 1 FROM new_prompt)
    ),
    -- Remove old prompt links for update
    remove_old_prompts AS (
        DELETE FROM agent_prompts_junction
        WHERE agent_id = (SELECT agent_id FROM params)
    ),
    link_prompt AS (
        -- Link agent to prompt if prompt_id exists
        INSERT INTO agent_prompts_junction (agent_id, prompt_id, active, created_at)
        SELECT 
            x.agent_id,
            sp.prompt_id,
            true,
            NOW()
        FROM params x
        CROSS JOIN selected_prompt_id sp
        WHERE sp.prompt_id IS NOT NULL
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
    -- Insert or UPDATE agent_artifact active flag (UPDATE handled above for update case, INSERT here handles both via ON CONFLICT)
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
    -- Create tools_resource entries for provided tool_ids
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
        SET name = p.name,
            description = p.description
        FROM agent_agents_junction j
        CROSS JOIN params p
        WHERE j.agents_id = r.id
          AND j.agent_id = p.agent_id
        RETURNING r.id
    )
    SELECT
        x.agent_id AS agent_id,
        ap.actor_name AS actor_name
    FROM params x
    CROSS JOIN validate_permissions vp
    WHERE vp.validation_passed = true;
END;
$$;

