-- Get first active model ID for test setup
-- Returns model_id for use in tests

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_first_model_v4();

-- Create function
CREATE OR REPLACE FUNCTION test_get_first_model_v4()
RETURNS TABLE (
    model_id uuid,
    name text,
    provider_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id as model_id,
        name,
        provider_id
    FROM models
    WHERE active = true
    LIMIT 1;
$$;

COMMIT;

