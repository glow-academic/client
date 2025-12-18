-- Delete cohort with usage check - returns usage_count and deleted (boolean)
-- Parameters: $1 = cohort_id (uuid), $2 = profile_id (uuid)
-- Returns: usage_count (int), deleted (boolean), title, actor_name
-- Note: Prevents deletion if ANY cohort_profile links exist (active or inactive) for historical data preservation

WITH actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
usage_check AS (
    SELECT COUNT(*) as usage_count
    FROM cohort_profiles cp
    WHERE cp.cohort_id = $1
),
delete_result AS (
    DELETE FROM cohorts 
    WHERE id = $1 
      AND (SELECT usage_count FROM usage_check) = 0
    RETURNING id, title
)
SELECT 
    (SELECT usage_count FROM usage_check) as usage_count,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted,
    (SELECT title FROM cohorts WHERE id = $1) as title,
    ap.actor_name
FROM actor_profile ap

