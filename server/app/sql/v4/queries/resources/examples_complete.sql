-- Create examples resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if example already exists)
-- Parameters: example (text), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: example_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_examples_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_examples_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_examples_v4(
    example text DEFAULT NULL,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    example_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_example_id uuid;
    v_call_id uuid;
    v_run_id uuid;
BEGIN
    -- Check if example already exists
    IF example IS NOT NULL THEN
        SELECT er.id INTO v_example_id
        FROM examples_resource er
        WHERE er.example = api_create_examples_v4.example
        LIMIT 1;

        IF v_example_id IS NOT NULL THEN
            RETURN QUERY SELECT v_example_id;
            RETURN;
        END IF;
    END IF;

    -- INSERT INTO examples_resource table
    INSERT INTO examples_resource(example, mcp, generated)
    VALUES (
        api_create_examples_v4.example,
        api_create_examples_v4.mcp,
        api_create_examples_v4.mcp
    )
    RETURNING id INTO v_example_id;

    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, 0, 0, 0, api_create_examples_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'examples_' || v_call_id::text, v_run_id, true, NOW(), NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_examples_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO examples_calls_connection (examples_id, call_id)
        VALUES (v_example_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_example_id;
END;
$$;
