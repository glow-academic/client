-- Create scenario_positions resource
-- Get or create operation (returns existing ID if scenario_id + value already exists)
-- Parameters: agent_id (uuid, optional), group_id (uuid, required), simulation_id (uuid, required), scenario_id (uuid, required), value (integer, required), mcp (boolean, optional)
-- Returns: id (uuid) - unique resource id

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_scenario_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_scenario_positions_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_scenario_positions_v4(
    agent_id uuid,
    group_id uuid,
    simulation_id uuid,
    scenario_id uuid,
    value integer,
    mcp boolean DEFAULT false
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
BEGIN
    -- Validate scenario exists (check _resource table since FK references scenarios_resource)
    IF NOT EXISTS (SELECT 1 FROM scenarios_resource WHERE id = api_create_scenario_positions_v4.scenario_id) THEN
        RAISE EXCEPTION 'Scenario % does not exist', api_create_scenario_positions_v4.scenario_id;
    END IF;

    -- Check if scenario_positions already exists (match on scenario_id + value)
    SELECT r.id INTO v_resource_id
    FROM scenario_positions_resource r
    WHERE r.scenario_id = api_create_scenario_positions_v4.scenario_id
      AND r.value = api_create_scenario_positions_v4.value
    LIMIT 1;

    IF v_resource_id IS NOT NULL THEN
        RETURN QUERY SELECT v_resource_id;
        RETURN;
    END IF;

    -- Simple insert - no call/run tracking needed for user-initiated selections
    INSERT INTO scenario_positions_resource (
        scenario_id,
        value,
        generated,
        mcp,
        created_at
    )
    VALUES (
        api_create_scenario_positions_v4.scenario_id,
        api_create_scenario_positions_v4.value,
        false,  -- User selection, not AI-generated
        mcp,
        NOW()
    )
    RETURNING id INTO v_resource_id;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
