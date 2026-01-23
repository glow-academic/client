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
    INSERT INTO profile_cohorts_junction(profile_id, cohort_id, active)
    VALUES (
        test_create_cohort_profile_link_v4.input_profile_id,
        test_create_cohort_profile_link_v4.input_cohort_id,
        true
    )
    RETURNING profile_id, cohort_id, active, created_at;
$$;