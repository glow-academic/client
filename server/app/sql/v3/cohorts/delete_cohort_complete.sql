-- Delete cohort with usage check - returns usage_count and deleted (boolean)
-- Converted to function
-- Note: Prevents deletion if ANY cohort_profile links exist (active or inactive) for historical data preservation

BEGIN;

DROP FUNCTION IF EXISTS api_delete_cohort_v3(uuid, uuid);

CREATE OR REPLACE FUNCTION api_delete_cohort_v3(
    cohort_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    usage_count bigint,
    deleted boolean,
    title text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        cohort_id AS cohort_id,
        profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        x.profile_id AS profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
usage_check AS (
    SELECT COUNT(*) as usage_count
    FROM params x
    JOIN cohort_profiles cp ON cp.cohort_id = x.cohort_id
),
delete_result AS (
    DELETE FROM cohorts c
    USING params x
    CROSS JOIN usage_check uc
    WHERE c.id = x.cohort_id 
      AND uc.usage_count = 0
    RETURNING c.id, c.title
)
SELECT 
    uc.usage_count,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted,
    COALESCE((SELECT title FROM delete_result LIMIT 1), (SELECT title FROM params x JOIN cohorts c ON c.id = x.cohort_id LIMIT 1)) as title,
    ap.actor_name
FROM actor_profile ap
CROSS JOIN usage_check uc
$$;

COMMIT;

