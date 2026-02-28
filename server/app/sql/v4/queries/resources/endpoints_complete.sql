-- Create endpoints resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if base_url already exists)
-- Parameters: base_url (text), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: endpoints_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_endpoints_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_endpoints_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_endpoints_v4(
    base_url text DEFAULT NULL,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    endpoints_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_endpoints_id uuid;
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Check if base_url already exists
    IF base_url IS NOT NULL THEN
        SELECT er.id INTO v_endpoints_id
        FROM endpoints_resource er
        WHERE er.base_url = api_create_endpoints_v4.base_url
          AND er.active = true
        LIMIT 1;

        IF v_endpoints_id IS NOT NULL THEN
            RETURN QUERY SELECT v_endpoints_id;
            RETURN;
        END IF;
    END IF;

    -- INSERT INTO endpoints_resource table
    INSERT INTO endpoints_resource(base_url, active, mcp, generated)
    VALUES (
        api_create_endpoints_v4.base_url,
        true,
        api_create_endpoints_v4.mcp,
        api_create_endpoints_v4.mcp
    )
    RETURNING id INTO v_endpoints_id;

    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, api_create_endpoints_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
        VALUES (v_call_id, 'endpoints_' || v_call_id::text, v_run_id, NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_endpoints_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO endpoints_calls_connection (endpoints_id, call_id)
        VALUES (v_endpoints_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_endpoints_id;
END;
$$;
