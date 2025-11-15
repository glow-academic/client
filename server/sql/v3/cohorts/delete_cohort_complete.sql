-- Delete cohort with usage check - returns usage_count and deleted (boolean)
-- Parameters: $1 = cohort_id (uuid)
-- Returns: usage_count (int), deleted (boolean)

WITH usage_check AS (
    SELECT COUNT(DISTINCT ap.attempt_id) as usage_count
    FROM cohort_profiles cp
    JOIN attempt_profiles ap ON ap.profile_id = cp.profile_id
    WHERE cp.cohort_id = $1 AND cp.active = true
),
delete_result AS (
    DELETE FROM cohorts 
    WHERE id = $1 
      AND (SELECT usage_count FROM usage_check) = 0
    RETURNING id
)
SELECT 
    (SELECT usage_count FROM usage_check) as usage_count,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted

