SELECT COUNT(DISTINCT ap.attempt_id) as usage_count
FROM cohort_profiles cp
JOIN attempt_profiles ap ON ap.profile_id = cp.profile_id
WHERE cp.cohort_id = $1 AND cp.active = true

