-- Get first active model ID for test setup
-- Returns model_id for use in tests
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
        m.id as model_id,
        (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) as name,
        NULL::uuid as provider_id  -- Providers are now enums, not UUIDs
    FROM models_resource m
    WHERE EXISTS (SELECT 1 FROM model_flags mf JOIN flags_resource fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active'  AND mf.value = TRUE)
    LIMIT 1;
$$;