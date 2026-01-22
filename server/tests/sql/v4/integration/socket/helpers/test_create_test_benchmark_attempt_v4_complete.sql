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
    INSERT INTO eval_attempts(eval_id, archived) 
    VALUES (test_create_test_benchmark_attempt_v4.eval_id, false) 
    RETURNING id as attempt_id;
$$;