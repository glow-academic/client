-- Create cohort-profile link for test setup
-- Returns link data for verification
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_cohort_profile_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_cohort_profile_link_v4(
    input_cohort_id uuid,
    input_profile_id uuid
)
RETURNS TABLE (
    cohort_id uuid,
    profile_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO cohort_profiles(cohort_id, profile_id, active)
    VALUES (
        test_create_cohort_profile_link_v4.input_cohort_id,
        test_create_cohort_profile_link_v4.input_profile_id,
        true
    )
    RETURNING cohort_id, profile_id, active, created_at;
$$;