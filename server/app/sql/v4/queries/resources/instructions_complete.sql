-- Create instructions resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if template already exists)
-- Parameters: template (text), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: instruction_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_instructions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_instructions_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_instructions_v4(
    template text DEFAULT NULL,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    instruction_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_instruction_id uuid;
    v_call_id uuid;
    v_run_id uuid;
BEGIN
    -- Check if instruction already exists
    IF template IS NOT NULL THEN
        SELECT ir.id INTO v_instruction_id
        FROM instructions_resource ir
        WHERE ir.template = api_create_instructions_v4.template
        LIMIT 1;

        IF v_instruction_id IS NOT NULL THEN
            RETURN QUERY SELECT v_instruction_id;
            RETURN;
        END IF;
    END IF;

    -- INSERT INTO instructions_resource table
    INSERT INTO instructions_resource(template, active, mcp, generated)
    VALUES (
        api_create_instructions_v4.template,
        true,
        api_create_instructions_v4.mcp,
        api_create_instructions_v4.mcp
    )
    RETURNING id INTO v_instruction_id;

    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
        VALUES (v_run_id, 0, 0, 0, api_create_instructions_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'instructions_' || v_call_id::text, v_run_id, true, NOW(), NOW());

        -- Link tool to call
        INSERT INTO tool_calls_junction (tool_id, call_id) VALUES (api_create_instructions_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO instructions_calls_connection (instructions_id, call_id)
        VALUES (v_instruction_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_instruction_id;
END;
$$;
