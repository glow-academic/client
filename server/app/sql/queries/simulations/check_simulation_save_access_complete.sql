-- Check simulation save access - Returns context for Python permission checks
-- Used before save operation to validate permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_simulation_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_simulation_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_check_simulation_save_access_v4(
    profile_id uuid,
    simulation_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    simulation_exists boolean,
    simulation_department_ids uuid[],
    cohort_usage_count int,
    draft_department_ids uuid[]
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
-- User context (role, actor_name) comes from get_profile_context_internal() in Python
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
    SELECT ARRAY_AGG(sd.departments_id) as department_ids
    FROM simulation_departments_junction sd
    WHERE sd.simulation_id = (SELECT p_simulation_id FROM params)
      AND sd.active = true
),
-- Get cohort usage count for the simulation
cohort_usage AS (
    SELECT COUNT(DISTINCT cs.cohort_id)::int as usage_count
    FROM cohort_simulations_junction cs
    WHERE cs.simulations_id = (SELECT p_simulation_id FROM params)
      AND cs.active = true
),
-- Get department IDs from draft (for create mode validation)
draft_departments AS (
    SELECT ARRAY_AGG(dd.department_id) as department_ids
    FROM simulation_drafts_departments_connection dd
    WHERE dd.draft_id = (SELECT p_draft_id FROM params)
)
SELECT
    (SELECT simulation_exists FROM simulation_exists_check),
    sd.department_ids as simulation_department_ids,
    COALESCE(cu.usage_count, 0)::int as cohort_usage_count,
    drd.department_ids as draft_department_ids
FROM simulation_departments sd
CROSS JOIN cohort_usage cu
CROSS JOIN draft_departments drd;
$$;

