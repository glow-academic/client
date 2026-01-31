-- Create scenario_rubrics resource
-- Get or create operation (returns existing ID if scenario_id + rubric_id already exists)
-- Parameters: agent_id (uuid, optional), group_id (uuid, required), scenario_id (uuid, required), rubric_id (uuid, required), mcp (boolean, optional)
-- Returns: id (uuid) - unique resource id

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
    agent_id uuid,
    group_id uuid,
    scenario_id uuid,
    rubric_id uuid,
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
    IF NOT EXISTS (SELECT 1 FROM scenarios_resource WHERE id = api_create_scenario_rubrics_v4.scenario_id) THEN
        RAISE EXCEPTION 'Scenario % does not exist', api_create_scenario_rubrics_v4.scenario_id;
    END IF;

    -- Validate rubric exists (check _resource table since FK references rubrics_resource)
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

    -- Simple insert - no call/run tracking needed for user-initiated selections
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
        false,  -- User selection, not AI-generated
        mcp,
        NOW()
    )
    RETURNING id INTO v_resource_id;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
