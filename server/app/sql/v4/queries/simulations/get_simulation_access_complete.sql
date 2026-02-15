-- Access check for simulation get (lightweight)
-- Returns simulation access context only
-- User context comes from get_auth_profile_internal() in Python
-- Group ID creation moved to Python

-- Drop all versions of the function using DO block to handle signature variations
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
    simulation_department_ids uuid[],
    simulation_exists boolean,
    group_id uuid,
    draft_version int,
    cohort_usage_count int,
    effective_draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id, simulation_id, draft_id
),
simulation_departments AS (
    SELECT COALESCE(
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT sd.department_id), NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM simulation_departments_junction sd
    WHERE sd.simulation_id = (SELECT simulation_id FROM params)
      AND sd.active = true
),
simulation_data AS (
    SELECT
        NULL::uuid as group_id,
        NULL::int as draft_version
    FROM simulation_artifact sa
    WHERE sa.id = (SELECT simulation_id FROM params)
    LIMIT 1
),
cohort_usage AS (
    SELECT COUNT(DISTINCT c.id) as usage_count
    FROM cohort_artifact c
    JOIN cohort_simulations_junction csj ON csj.cohort_id = c.id
    JOIN cohort_flags_junction cfj ON cfj.cohort_id = c.id
    JOIN flags_resource f ON f.id = cfj.flag_id
    WHERE csj.simulation_id = (SELECT simulation_id FROM params)
      AND csj.active = true
      AND f.name = 'cohort_active'
      AND cfj.value = true
)
SELECT
    CASE
        WHEN (SELECT simulation_id FROM params) IS NULL THEN ARRAY[]::uuid[]
        ELSE COALESCE((SELECT department_ids FROM simulation_departments), ARRAY[]::uuid[])
    END as simulation_department_ids,
    CASE
        WHEN (SELECT simulation_id FROM params) IS NULL THEN NULL::boolean
        ELSE EXISTS(
            SELECT 1 FROM simulation_artifact sa WHERE sa.id = (SELECT simulation_id FROM params)
        )::boolean
    END as simulation_exists,
    NULL::uuid as group_id,
    (SELECT draft_version FROM simulation_data) as draft_version,
    COALESCE((SELECT usage_count FROM cohort_usage), 0)::int as cohort_usage_count,
    (SELECT draft_version FROM simulation_data) as effective_draft_version
FROM params;
$$;
