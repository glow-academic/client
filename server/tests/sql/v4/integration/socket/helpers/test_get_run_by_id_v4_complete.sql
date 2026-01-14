-- Get run by ID for test verification
-- Returns run details
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_run_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_run_by_id_v4(
    run_id uuid
)
RETURNS TABLE (
    id uuid,
    input_tokens integer,
    output_tokens integer
)
LANGUAGE sql
STABLE
AS $$
    SELECT id, input_tokens, output_tokens 
    FROM runs 
    WHERE id = test_get_run_by_id_v4.run_id;
$$;