INSERT INTO cohort_profiles (cohort_id, profile_id, active)
SELECT $1, profile_id, active
FROM cohort_profiles
WHERE cohort_id = $2

