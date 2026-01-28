-- Get simulation access check - Pass 1 of two-pass architecture
-- Returns user context and simulation state for permission checks in Python

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_simulation_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_simulation_access_v4(
    profile_id uuid,
    simulation_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    simulation_exists boolean,
    draft_version int,
    group_id uuid,
    user_role text,
    user_department_ids uuid[],
    simulation_department_ids uuid[],
    cohort_usage_count int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS p_profile_id,
        simulation_id AS p_simulation_id,
        draft_id AS p_draft_id
),
-- Get user profile info
user_profile AS (
    SELECT
        vp.actor_name,
        vp.role::text as user_role
    FROM view_user_profile_context vp
    WHERE vp.profile_id = (SELECT p_profile_id FROM params)
),
-- Get user's department IDs
user_departments AS (
    SELECT ARRAY_AGG(pd.department_id) as department_ids
    FROM profile_departments_junction pd
    WHERE pd.profile_id = (SELECT p_profile_id FROM params)
      AND pd.active = true
),
-- Check if simulation exists (only if simulation_id provided)
simulation_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT p_simulation_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM simulation_artifact WHERE id = (SELECT p_simulation_id FROM params))::boolean
        END as simulation_exists
),
-- Get simulation's department IDs (only if simulation exists)
simulation_departments AS (
    SELECT ARRAY_AGG(sd.department_id) as department_ids
    FROM simulation_departments_junction sd
    WHERE sd.simulation_id = (SELECT p_simulation_id FROM params)
      AND sd.active = true
),
-- Get cohort usage count for the simulation
cohort_usage AS (
    SELECT COUNT(DISTINCT cs.cohort_id)::int as usage_count
    FROM cohort_simulations_junction cs
    WHERE cs.simulation_id = (SELECT p_simulation_id FROM params)
      AND cs.active = true
),
-- Get group_id from draft or fallback to latest
draft_group AS (
    SELECT
        COALESCE(
            d.group_id,
            (SELECT id FROM groups_entry ORDER BY created_at DESC LIMIT 1)
        ) as group_id,
        d.version as draft_version
    FROM params x
    LEFT JOIN drafts_entry d ON d.id = x.p_draft_id
    LIMIT 1
)
SELECT
    up.actor_name::text,
    (SELECT simulation_exists FROM simulation_exists_check),
    dg.draft_version::int,
    dg.group_id,
    up.user_role::text,
    ud.department_ids as user_department_ids,
    sd.department_ids as simulation_department_ids,
    COALESCE(cu.usage_count, 0)::int as cohort_usage_count
FROM user_profile up
CROSS JOIN user_departments ud
CROSS JOIN simulation_departments sd
CROSS JOIN cohort_usage cu
CROSS JOIN draft_group dg;
$$;
