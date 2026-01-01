-- Create a test test for benchmark tests
-- Returns test_id
-- Note: tests table requires run_id, so we need to create a run first

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_test_v4(text, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_test_v4(
    title text DEFAULT 'Test Test',
    run_id uuid DEFAULT NULL
)
RETURNS TABLE (
    test_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO tests(title, run_id, completed, trace_id) 
    VALUES (
        test_create_test_test_v4.title, 
        COALESCE(test_create_test_test_v4.run_id, gen_random_uuid()),
        false,
        'test-trace-id'
    ) 
    RETURNING id as test_id;
$$;

COMMIT;

