-- Create pricing resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Always INSERT operation
-- Parameters: mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: pricing_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_pricing_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_pricing_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_pricing_v4(
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    pricing_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_pricing_id uuid;
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- INSERT INTO pricing_resource table
    INSERT INTO pricing_resource(active, mcp)
    VALUES (true, mcp)
    RETURNING id INTO v_pricing_id;
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, 0, 0, 0, api_create_pricing_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'pricing_' || v_call_id::text, v_run_id, true, NOW(), NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_pricing_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO pricing_calls_connection (pricing_id, call_id)
        VALUES (v_pricing_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_pricing_id;
END;
$$;
