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
    INSERT INTO cohorts(
        title,
        description,
        active
    )
    VALUES (
        COALESCE(test_create_test_cohort_v4.title, 'Test Cohort'),
        COALESCE(test_create_test_cohort_v4.description, 'Test Description'),
        COALESCE(test_create_test_cohort_v4.active, true)
    )
    RETURNING id, title, description, active, created_at;
$$;