-- Create prompts resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if name already exists)
-- Parameters: system_prompt (text), name (text), description (text), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: prompt_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_prompts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_prompts_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_prompts_v4(
    system_prompt text,
    name text,
    description text,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    prompt_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_prompt_id uuid;
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Check if prompts already exists (match on name)
    SELECT r.id INTO v_prompt_id
    FROM prompts_resource r
    WHERE r.name = api_create_prompts_v4.name
    LIMIT 1;

    IF v_prompt_id IS NOT NULL THEN
        RETURN QUERY SELECT v_prompt_id;
        RETURN;
    END IF;

    -- INSERT INTO prompts_resource table
    INSERT INTO prompts_resource(system_prompt, name, description, active, mcp)
    VALUES (system_prompt, name, description, true, mcp)
    RETURNING id INTO v_prompt_id;
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, 0, 0, 0, api_create_prompts_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'prompts_' || v_call_id::text, v_run_id, true, NOW(), NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_prompts_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO prompts_calls_connection (prompts_id, call_id)
        VALUES (v_prompt_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_prompt_id;
END;
$$;
