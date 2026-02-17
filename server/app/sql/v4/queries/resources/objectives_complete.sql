-- Create objectives resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if objective already exists)
-- Parameters: objective (text), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: objective_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_objectives_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_objectives_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_objectives_v4(
    objective text,
    mcp boolean DEFAULT false,
    group_id uuid DEFAULT NULL,
    tool_id uuid DEFAULT NULL
)
RETURNS TABLE (
    objective_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_objective_id uuid;
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Check if objectives already exists (match on objective)
    SELECT r.id INTO v_objective_id
    FROM objectives_resource r
    WHERE r.objective = api_create_objectives_v4.objective
    LIMIT 1;

    IF v_objective_id IS NOT NULL THEN
        RETURN QUERY SELECT v_objective_id;
        RETURN;
    END IF;

    -- INSERT INTO objectives_resource table
    INSERT INTO objectives_resource(objective, active, mcp)
    VALUES (objective, true, mcp)
    RETURNING id INTO v_objective_id;
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, 0, 0, 0, api_create_objectives_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'objectives_' || v_call_id::text, v_run_id, true, NOW(), NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_objectives_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO objectives_calls_connection (objectives_id, call_id)
        VALUES (v_objective_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_objective_id;
END;
$$;
