-- Home context for training list endpoint.
-- Returns actor identity + access context + pass threshold.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_home_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_home_context_v4(%s)', r.sig);
    END LOOP;
END $$;

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
    SELECT api_get_home_context_v4.profile_id AS profile_id
),
profile_info AS (
    SELECT
        pr.id,
        COALESCE(pr.name, '') AS actor_name,
        COALESCE(pr.role, 'member'::profile_type)::text AS user_role
    FROM profiles_resource pr
    JOIN params p ON p.profile_id = pr.id
),
user_cohorts AS (
    SELECT COALESCE(ARRAY_AGG(pcj.cohort_id), ARRAY[]::uuid[]) AS user_cohort_ids
    FROM profile_cohorts_junction pcj
    JOIN params p ON p.profile_id = pcj.profile_id
    WHERE pcj.active = TRUE
),
accessible_cohorts AS (
    SELECT
        CASE
            WHEN pi.user_role IN ('instructional', 'admin', 'superadmin') THEN
                COALESCE(
                    (
                        SELECT ARRAY_AGG(DISTINCT ccj.cohort_id)
                        FROM cohort_cohorts_junction ccj
                        JOIN profile_cohorts_junction pcj ON pcj.cohort_id = ccj.cohorts_id
                        JOIN params p ON p.profile_id = pcj.profile_id
                        WHERE pcj.active = TRUE
                    ),
                    ARRAY[]::uuid[]
                )
            ELSE COALESCE((SELECT uc.user_cohort_ids FROM user_cohorts uc), ARRAY[]::uuid[])
        END AS accessible_cohort_ids
    FROM profile_info pi
)
SELECT
    pi.actor_name,
    pi.user_role,
    COALESCE((SELECT uc.user_cohort_ids FROM user_cohorts uc), ARRAY[]::uuid[]),
    COALESCE((SELECT ac.accessible_cohort_ids FROM accessible_cohorts ac), ARRAY[]::uuid[]),
    70.0::numeric AS pass_threshold
FROM profile_info pi;
$$;
