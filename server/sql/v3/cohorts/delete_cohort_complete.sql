-- Delete cohort with usage check - returns usage_count and deleted (boolean)
-- Parameters: $1 = cohort_id (uuid)
-- Returns: usage_count (int), deleted (boolean)
-- Note: Prevents deletion if ANY cohort_profile links exist (active or inactive) for historical data preservation

WITH usage_check AS (
    SELECT COUNT(*) as usage_count
    FROM cohort_profiles cp
    WHERE cp.cohort_id = $1
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

