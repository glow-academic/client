-- Create a test group for socket view_tests_entry
-- Returns group_id
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
    -- NOTE: view_groups_entry table doesn't have rubric_id or active columns
    -- trace_id is auto-generated, rubric_id is stored in rubric_groups table
    INSERT INTO groups_entry (trace_id) 
    VALUES (COALESCE(test_create_test_group_v4.trace_id, gen_trace_id())) 
    RETURNING id as group_id;
$$;