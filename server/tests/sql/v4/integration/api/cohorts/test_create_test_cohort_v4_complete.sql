-- Create a test cohort for test setup
-- Returns cohort_id for use in tests
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_cohort_v4(text, text, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_cohort_v4(
    title text DEFAULT 'Test Cohort',
    description text DEFAULT 'Test Description',
    active boolean DEFAULT true
)
RETURNS TABLE (
    cohort_id uuid,
    title text,
    description text,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_cohort AS (
        INSERT INTO cohorts DEFAULT VALUES
        RETURNING id, created_at
    ),
    name_resource AS (
        INSERT INTO names(name)
        VALUES (COALESCE(test_create_test_cohort_v4.title, 'Test Cohort'))
        RETURNING id
    ),
    description_resource AS (
        INSERT INTO descriptions(description)
        VALUES (COALESCE(test_create_test_cohort_v4.description, 'Test Description'))
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags WHERE name = 'active' LIMIT 1
    ),
    cohort_name_link AS (
        INSERT INTO cohort_names(cohort_id, name_id)
        SELECT nc.id, nr.id
        FROM new_cohort nc, name_resource nr
        RETURNING cohort_id
    ),
    cohort_description_link AS (
        INSERT INTO cohort_descriptions(cohort_id, description_id)
        SELECT nc.id, dr.id
        FROM new_cohort nc, description_resource dr
        RETURNING cohort_id
    ),
    cohort_flag_link AS (
        INSERT INTO cohort_flags(cohort_id, flag_id, type, value)
        SELECT nc.id, af.id, 'active'::type_cohort_flags, COALESCE(test_create_test_cohort_v4.active, true)
        FROM new_cohort nc, active_flag af
        RETURNING cohort_id
    )
    SELECT 
        nc.id as cohort_id,
        (SELECT n.name FROM cohort_names cn JOIN names n ON cn.name_id = n.id WHERE cn.cohort_id = nc.id LIMIT 1) as title,
        (SELECT d.description FROM cohort_descriptions cd JOIN descriptions d ON cd.description_id = d.id WHERE cd.cohort_id = nc.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags fl ON cf.flag_id = fl.id WHERE cf.cohort_id = nc.id AND fl.name = 'active' AND cf.type = 'active'::type_cohort_flags AND cf.value = TRUE) as active,
        nc.created_at
    FROM new_cohort nc;
$$;