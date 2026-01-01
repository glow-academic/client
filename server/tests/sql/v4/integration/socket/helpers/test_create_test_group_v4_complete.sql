-- Create a test group for socket tests
-- Returns group_id

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_group_v4(uuid, text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_group_v4(
    rubric_id uuid,
    trace_id text DEFAULT 'test-trace-id'
)
RETURNS TABLE (
    group_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO groups(rubric_id, trace_id, active) 
    VALUES (test_create_test_group_v4.rubric_id, test_create_test_group_v4.trace_id, true) 
    RETURNING id as group_id;
$$;

COMMIT;

