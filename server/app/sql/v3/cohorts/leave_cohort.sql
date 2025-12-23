-- Deactivate cohort profile link (preserves history)
-- Parameters: $1=cohort_id (uuid), $2=profile_id (uuid)
-- Returns: cohort_id, cohort_title, actor_name
WITH actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
cohort_info AS (
    SELECT id, title FROM cohorts WHERE id = $1
),
update_result AS (
    UPDATE cohort_profiles
    SET active = false, updated_at = NOW()
    WHERE cohort_id = $1 AND profile_id = $2
    RETURNING cohort_id
)
SELECT 
    ci.id::text as cohort_id,
    ci.title as cohort_title,
    ap.actor_name
FROM cohort_info ci
CROSS JOIN actor_profile ap
WHERE EXISTS (SELECT 1 FROM update_result)

