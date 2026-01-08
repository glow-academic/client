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
        (SELECT n.name FROM model_names mn JOIN names n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) as name,
        (SELECT mp.provider_id FROM model_providers mp WHERE mp.model_id = m.id LIMIT 1) as provider_id
    FROM models m
    WHERE EXISTS (SELECT 1 FROM model_flags mf JOIN flags fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active' AND mf.type = 'active'::type_model_flags AND mf.value = TRUE)
    LIMIT 1;
$$;