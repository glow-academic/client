-- Get count of active models for test verification
-- Returns count for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_active_models_count_v4();

-- Create function
CREATE OR REPLACE FUNCTION test_get_active_models_count_v4()
RETURNS TABLE (
    count bigint
)
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*) as count
    FROM models
    WHERE active = true;
$$;

COMMIT;

