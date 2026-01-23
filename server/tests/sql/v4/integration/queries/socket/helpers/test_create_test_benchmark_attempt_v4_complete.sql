-- Create a test benchmark attempt for socket tests_entry
-- Returns attempt_id
-- Note: Uses eval_attempts table (not benchmark_attempts)
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_benchmark_attempt_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_benchmark_attempt_v4(
    eval_id uuid
)
RETURNS TABLE (
    attempt_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_attempt AS (
        INSERT INTO eval_attempts(archived)
        VALUES (false)
        RETURNING id
    ),
    junction_insert AS (
        INSERT INTO eval_attempts_junction(eval_id, attempt_id)
        SELECT test_create_test_benchmark_attempt_v4.eval_id, new_attempt.id
        FROM new_attempt
    )
    SELECT id AS attempt_id FROM new_attempt;
$$;