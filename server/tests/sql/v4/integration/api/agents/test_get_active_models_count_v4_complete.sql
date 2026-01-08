-- Get count of active models for test verification
-- Returns count for assertions
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
    FROM models m
    WHERE EXISTS (SELECT 1 FROM model_flags mf JOIN flags fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active' AND mf.type = 'active'::type_model_flags AND mf.value = TRUE);
$$;