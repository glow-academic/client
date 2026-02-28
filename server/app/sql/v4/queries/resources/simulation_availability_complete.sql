-- Create simulation_availability resource
-- Get or create operation
-- Parameters: simulation_id (uuid), time (timestamptz), type (text: 'start' or 'end'), mcp (boolean), group_id (uuid), tool_id (uuid)
-- Returns: id (uuid)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_simulation_availability_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_simulation_availability_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_simulation_availability_v4(
    simulation_id uuid,
    availability_time timestamptz,
    type text DEFAULT 'start',
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
    v_type availability_type;
BEGIN
    -- Cast text to availability_type enum
    v_type := api_create_simulation_availability_v4.type::availability_type;

    -- Check if availability already exists for this simulation + type
    SELECT r.id INTO v_resource_id
    FROM simulation_availability_resource r
    WHERE r.simulation_id = api_create_simulation_availability_v4.simulation_id
      AND r.type = v_type
    LIMIT 1;

    IF v_resource_id IS NOT NULL THEN
        -- Update existing
        UPDATE simulation_availability_resource
        SET time = api_create_simulation_availability_v4.availability_time,
            mcp = api_create_simulation_availability_v4.mcp,
            updated_at = NOW()
        WHERE id = v_resource_id;
        RETURN QUERY SELECT v_resource_id;
        RETURN;
    END IF;

    -- Insert new
    INSERT INTO simulation_availability_resource (
        simulation_id, time, type, generated, mcp, active, created_at, updated_at
    )
    VALUES (
        api_create_simulation_availability_v4.simulation_id,
        api_create_simulation_availability_v4.availability_time,
        v_type,
        true,
        mcp,
        true,
        NOW(),
        NOW()
    )
    ON CONFLICT (simulation_id, type)
    DO UPDATE SET
        time = EXCLUDED.time,
        mcp = EXCLUDED.mcp,
        updated_at = NOW()
    RETURNING id INTO v_resource_id;

    -- Tracking entries
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, api_create_simulation_availability_v4.group_id, NOW(), NOW());

        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
        VALUES (v_call_id, 'simulation_availability_' || v_call_id::text, v_run_id, NOW());

        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_simulation_availability_v4.tool_id, v_call_id);

        INSERT INTO simulation_availability_calls_connection (simulation_availability_id, call_id)
        VALUES (v_resource_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
