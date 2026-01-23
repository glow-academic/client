-- Create a test run for socket tests_entry
-- Returns run_id for use in tests_entry
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
    WITH new_run AS (
        INSERT INTO runs_entry (input_tokens, output_tokens)
        VALUES (0, 0)
        RETURNING id
    ),
    junction_insert AS (
        INSERT INTO agent_runs_junction(agent_id, run_id)
        SELECT test_create_test_run_v4.agent_id, new_run.id
        FROM new_run
        WHERE test_create_test_run_v4.agent_id IS NOT NULL
    )
    SELECT
        new_run.id,
        test_create_test_run_v4.department_id,
        test_create_test_run_v4.model_id,
        test_create_test_run_v4.agent_id
    FROM new_run;
$$;