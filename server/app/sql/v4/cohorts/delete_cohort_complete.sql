-- Delete cohort with usage check - returns usage_count and deleted (boolean)
-- Converted to function
-- Note: Prevents deletion if ANY cohort_profile links exist (active or inactive) for historical data preservation
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_cohort_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_cohort_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_delete_cohort_v4(
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
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
usage_check AS (
    SELECT COUNT(*) as usage_count
    FROM params x
    JOIN profile_cohorts cp ON cp.cohort_id = x.cohort_id
),
cohort_title AS (
    -- Get cohort title before deletion
    SELECT (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as title
    FROM params x
    JOIN cohort_artifact c ON c.id = x.cohort_id
),
delete_result AS (
    DELETE FROM cohort_artifact c
    USING params x
    CROSS JOIN usage_check uc
    WHERE c.id = x.cohort_id 
      AND uc.usage_count = 0
    RETURNING c.id
)
SELECT 
    uc.usage_count,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted,
    ct.title,
    ap.actor_name
FROM actor_profile ap
CROSS JOIN usage_check uc
CROSS JOIN cohort_title ct
$$;
