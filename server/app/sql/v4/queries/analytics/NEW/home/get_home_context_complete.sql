-- Get home context for two-pass pattern (Query 1 - cheap context query)
-- Returns user context, permissions, and settings for use in Python business logic
-- Queries only lightweight tables: profiles_resource, profile_cohorts_junction, cohort_cohorts_junction

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_home_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_home_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_get_home_context_v4(
    profile_id uuid
)
RETURNS TABLE (
    actor_name text,
    user_role text,
    user_cohort_ids uuid[],
    accessible_cohort_ids uuid[],
    pass_threshold numeric
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id
),
-- Get profile info
profile_info AS (
    SELECT
        pr.id,
        pr.name AS actor_name,
        pr.role AS user_role
    FROM profiles_resource pr
    CROSS JOIN params p
    WHERE pr.id = p.profile_id
),
-- Get user's direct cohort memberships
user_cohorts AS (
    SELECT ARRAY_AGG(pcj.cohort_id) AS user_cohort_ids
    FROM profile_cohorts_junction pcj
    CROSS JOIN params p
    WHERE pcj.profile_id = p.profile_id
      AND pcj.active = TRUE
),
-- Get accessible cohorts for instructional users (cohorts they can view)
-- For instructional: all cohorts linked via cohort_cohorts_junction to user's cohorts
-- For member: only their own cohorts
accessible_cohorts AS (
    SELECT
        CASE
            WHEN pi.user_role IN ('instructional', 'admin', 'superadmin') THEN
                COALESCE(
                    (SELECT ARRAY_AGG(DISTINCT ccj.cohort_id)
                     FROM cohort_cohorts_junction ccj
                     CROSS JOIN params p
                     JOIN profile_cohorts_junction pcj ON pcj.cohort_id = ccj.cohorts_id
                     WHERE pcj.profile_id = p.profile_id
                       AND pcj.active = TRUE),
                    ARRAY[]::uuid[]
                )
            ELSE
                COALESCE((SELECT user_cohort_ids FROM user_cohorts), ARRAY[]::uuid[])
        END AS accessible_cohort_ids
    FROM profile_info pi
)
SELECT
    pi.actor_name,
    pi.user_role,
    COALESCE((SELECT user_cohort_ids FROM user_cohorts), ARRAY[]::uuid[]),
    (SELECT accessible_cohort_ids FROM accessible_cohorts),
    70.0::numeric AS pass_threshold  -- Default pass threshold
FROM profile_info pi
$$;
