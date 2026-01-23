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
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        c.id as cohort_id,
        (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as title,
        (SELECT d.description FROM cohort_descriptions_junction cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource fl ON cf.flag_id = fl.id WHERE cf.cohort_id = c.id AND fl.name = 'active'  AND cf.value = TRUE) as active,
        c.created_at
    FROM cohorts_resource c
    WHERE c.id = test_get_cohort_by_id_v4.input_cohort_id;
$$;
