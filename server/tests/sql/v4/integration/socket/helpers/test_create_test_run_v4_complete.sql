-- Create a test run for socket tests
-- Returns run_id for use in tests
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_run_v4(uuid, uuid, uuid, text, uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_run_v4(
    department_id uuid,
    model_id uuid,
    agent_id uuid DEFAULT NULL,
    entity_type text DEFAULT 'agent',
    profile_id uuid DEFAULT NULL,
    entity_id uuid DEFAULT NULL
)
RETURNS TABLE (
    run_id uuid,
    department_id uuid,
    model_id uuid,
    agent_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO runs (input_tokens, output_tokens, agent_id)
    VALUES (0, 0, test_create_test_run_v4.agent_id)
    RETURNING id, test_create_test_run_v4.department_id, test_create_test_run_v4.model_id, test_create_test_run_v4.agent_id;
$$;