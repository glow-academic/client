-- Create a test run for socket view_tests_entry
-- Returns run_id for use in view_tests_entry
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
    -- agent_runs_junction removed; runs now link to agents via config_agents_connection
    junction_insert AS (
        SELECT 1 WHERE false
    )
    SELECT
        new_run.id,
        test_create_test_run_v4.department_id,
        test_create_test_run_v4.model_id,
        test_create_test_run_v4.agent_id
    FROM new_run;
$$;