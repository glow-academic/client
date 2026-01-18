-- Deactivate cohort profile link (preserves history)
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_leave_cohort_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_leave_cohort_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_leave_cohort_v4(
    cohort_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    cohort_title text,
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
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
cohort_info AS (
    SELECT 
        c.id, 
        (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as title
    FROM params x 
    JOIN cohort_artifact c ON c.id = x.cohort_id
),
update_result AS (
    UPDATE profile_cohorts
    SET active = false, updated_at = NOW()
    FROM params x
    WHERE profile_cohorts.cohort_id = x.cohort_id 
      AND profile_cohorts.profile_id = x.profile_id
    RETURNING profile_cohorts.cohort_id
)
SELECT 
    ci.title as cohort_title,
    ap.actor_name
FROM cohort_info ci
CROSS JOIN actor_profile ap
WHERE EXISTS (SELECT 1 FROM update_result)
$$;