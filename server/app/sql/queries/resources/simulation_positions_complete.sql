-- Create simulation_positions resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if simulation_id already exists)
-- Parameters: simulation_id (uuid), value (integer), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_simulation_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_simulation_positions_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_simulation_positions_v4(
    simulation_id uuid,
    value integer,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_resource_id uuid;
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Check if simulation_positions already exists (match on simulation_id)
    SELECT r.id INTO v_resource_id
    FROM simulation_positions_resource r
    WHERE r.simulation_id = api_create_simulation_positions_v4.simulation_id
    LIMIT 1;

    IF v_resource_id IS NOT NULL THEN
        RETURN QUERY SELECT v_resource_id;
        RETURN;
    END IF;

    -- INSERT or UPDATE INTO simulation_positions_resource
    INSERT INTO simulation_positions_resource (
        simulation_id,
        value,
        generated,
        mcp,
        created_at
    )
    VALUES (
        api_create_simulation_positions_v4.simulation_id,
        api_create_simulation_positions_v4.value,
        true,
        mcp,
        NOW()
    )
    ON CONFLICT (simulation_id, value)
    DO UPDATE SET
        value = EXCLUDED.value,
        generated = EXCLUDED.generated,
        mcp = EXCLUDED.mcp
    RETURNING id INTO v_resource_id;
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, api_create_simulation_positions_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
        VALUES (v_call_id, 'simulation_positions_' || v_call_id::text, v_run_id, NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_simulation_positions_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO simulation_positions_calls_connection (simulation_positions_id, call_id)
        VALUES (v_resource_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
