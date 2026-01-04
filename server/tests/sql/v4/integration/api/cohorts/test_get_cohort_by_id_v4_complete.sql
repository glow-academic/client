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
        id as cohort_id,
        title,
        description,
        active,
        created_at,
        updated_at
    FROM cohorts
    WHERE id = test_get_cohort_by_id_v4.input_cohort_id;
$$;