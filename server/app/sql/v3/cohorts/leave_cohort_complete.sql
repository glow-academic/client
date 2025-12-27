-- Deactivate cohort profile link (preserves history)
-- Converted to function

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_leave_cohort_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_leave_cohort_v3(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_leave_cohort_v3(
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
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
cohort_info AS (
    SELECT id, title FROM params x JOIN cohorts c ON c.id = x.cohort_id
),
update_result AS (
    UPDATE cohort_profiles
    SET active = false, updated_at = NOW()
    FROM params x
    WHERE cohort_profiles.cohort_id = x.cohort_id 
      AND cohort_profiles.profile_id = x.profile_id
    RETURNING cohort_profiles.cohort_id
)
SELECT 
    ci.title as cohort_title,
    ap.actor_name
FROM cohort_info ci
CROSS JOIN actor_profile ap
WHERE EXISTS (SELECT 1 FROM update_result)
$$;

COMMIT;

