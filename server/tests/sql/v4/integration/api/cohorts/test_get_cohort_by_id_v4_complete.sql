-- Get cohort by ID for test verification
-- Returns cohort data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_cohort_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_cohort_by_id_v4(
    input_cohort_id uuid
)
RETURNS TABLE (
    cohort_id uuid,
    title text,
    description text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        c.id as cohort_id,
        (SELECT n.name FROM cohort_names cn JOIN names n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as title,
        (SELECT d.description FROM cohort_descriptions cd JOIN descriptions d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags fl ON cf.flag_id = fl.id WHERE cf.cohort_id = c.id AND fl.name = 'active' AND cf.type = 'active'::type_cohort_flags AND cf.value = TRUE) as active,
        c.created_at,
        c.updated_at
    FROM cohorts c
    WHERE c.id = test_get_cohort_by_id_v4.input_cohort_id;
$$;