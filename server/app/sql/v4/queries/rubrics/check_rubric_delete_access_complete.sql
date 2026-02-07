-- Rubric Delete Access Check
-- Returns user role and rubric state for Python to compute delete permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_rubric_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_rubric_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_rubric_delete_access_v4(
    profile_id uuid,
    rubric_id uuid
)
RETURNS TABLE (
    -- User context for Python permission logic
    user_role text,
    -- Rubric state for Python permission logic
    rubric_department_ids text[],
    total_simulation_links bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        rubric_id AS rubric_id
),
-- Get user profile info
user_profile AS (
    SELECT role
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Get rubric departments
rubric_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(rd.department_id::text) FILTER (WHERE rd.department_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN rubric_departments_junction rd ON rd.rubric_id = x.rubric_id AND rd.active = true
),
-- Count total simulation links (active or not)
simulation_links AS (
    SELECT COALESCE(
        (SELECT COUNT(DISTINCT ss.simulation_id)
         FROM simulation_scenarios_junction ss
         JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
         JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
         WHERE srr.rubric_id = (SELECT rubric_id FROM params)
        ),
        0
    )::bigint as total_links
)
SELECT
    up.role::text as user_role,
    (SELECT department_ids FROM rubric_departments_data) as rubric_department_ids,
    (SELECT total_links FROM simulation_links) as total_simulation_links
FROM params x
CROSS JOIN user_profile up;
$$;
