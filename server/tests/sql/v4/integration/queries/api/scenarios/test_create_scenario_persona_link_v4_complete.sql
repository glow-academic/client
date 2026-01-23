-- Create scenario-persona link for test setup
-- Returns link data for verification
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_scenario_persona_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_scenario_persona_link_v4(
    input_scenario_id uuid,
    input_persona_id uuid
)
RETURNS TABLE (
    scenario_id uuid,
    persona_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO scenario_personas_junction(scenario_id, persona_id, active, created_at)
    VALUES (
        test_create_scenario_persona_link_v4.input_scenario_id,
        test_create_scenario_persona_link_v4.input_persona_id,
        true,
        NOW()
    )
    RETURNING scenario_id, persona_id, active, created_at;
$$;
