-- Create scenario_rubrics resource
-- SIMPLIFIED: No agent_id required, optional tool_id for tracking
-- Get or create operation (returns existing ID if scenario_id + rubric_id already exists)
-- Parameters: scenario_id (uuid), rubric_id (uuid), mcp (boolean), group_id (uuid, optional), tool_id (uuid, optional)
-- Returns: id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_scenario_rubrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_scenario_rubrics_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_scenario_rubrics_v4(
    scenario_id uuid,
    rubric_id uuid,
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
    -- Validate scenario exists
    IF NOT EXISTS (SELECT 1 FROM scenarios_resource WHERE id = api_create_scenario_rubrics_v4.scenario_id) THEN
        RAISE EXCEPTION 'Scenario % does not exist', api_create_scenario_rubrics_v4.scenario_id;
    END IF;

    -- Validate rubric exists
    IF NOT EXISTS (SELECT 1 FROM rubrics_resource WHERE id = api_create_scenario_rubrics_v4.rubric_id) THEN
        RAISE EXCEPTION 'Rubric % does not exist', api_create_scenario_rubrics_v4.rubric_id;
    END IF;

    -- Check if scenario_rubrics already exists (match on scenario_id + rubric_id)
    SELECT r.id INTO v_resource_id
    FROM scenario_rubrics_resource r
    WHERE r.scenario_id = api_create_scenario_rubrics_v4.scenario_id
      AND r.rubric_id = api_create_scenario_rubrics_v4.rubric_id
    LIMIT 1;

    IF v_resource_id IS NOT NULL THEN
        RETURN QUERY SELECT v_resource_id;
        RETURN;
    END IF;

    -- INSERT INTO scenario_rubrics_resource
    INSERT INTO scenario_rubrics_resource (
        scenario_id,
        rubric_id,
        active,
        generated,
        mcp,
        created_at
    )
    VALUES (
        api_create_scenario_rubrics_v4.scenario_id,
        api_create_scenario_rubrics_v4.rubric_id,
        true,
        false,
        mcp,
        NOW()
    )
    RETURNING id INTO v_resource_id;
    -- If tool_id and group_id provided, create run and call for tracking
    IF tool_id IS NOT NULL AND group_id IS NOT NULL THEN
        -- Create run record
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, api_create_scenario_rubrics_v4.group_id, NOW(), NOW());

        -- Create call record
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
        VALUES (v_call_id, 'scenario_rubrics_' || v_call_id::text, v_run_id, true, NOW(), NOW());

        -- Link tool to call
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES (api_create_scenario_rubrics_v4.tool_id, v_call_id);

        -- Link resource to call
        INSERT INTO scenario_rubrics_calls_connection (scenario_rubrics_id, call_id)
        VALUES (v_resource_id, v_call_id);
    END IF;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
