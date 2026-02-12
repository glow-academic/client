-- Scenario Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and scenario state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_scenario_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_scenario_access_v4(
    profile_id uuid,
    scenario_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    scenario_exists boolean,
    draft_version int,
    group_id uuid,


    -- Scenario state for Python permission logic
    scenario_department_ids uuid[],
    active_simulation_count int
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        scenario_id AS scenario_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Check if scenario exists
scenario_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT scenario_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM scenario_artifact WHERE id = (SELECT scenario_id FROM params))::boolean
        END as scenario_exists
),
-- Get group_id from draft
draft_group_data AS (
    SELECT
        COALESCE(
            d.group_id,
            (SELECT id FROM view_groups_entry ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN view_drafts_entry d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
),
-- Get draft version
draft_version_data AS (
    SELECT d.version as draft_version
    FROM params x
    LEFT JOIN view_drafts_entry d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
),
-- Get scenario departments (for access check)
scenario_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(sd.department_id ORDER BY sd.created_at) FILTER (WHERE sd.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN scenario_departments_junction sd ON sd.scenario_id = x.scenario_id AND sd.active = true
    WHERE x.scenario_id IS NOT NULL
),
-- Get scenario edit state (for active_simulation_count)
scenario_edit_state AS (
    SELECT COUNT(*) as active_simulation_count
    FROM params x
    JOIN simulation_scenarios_junction ssj ON ssj.scenario_id = x.scenario_id AND ssj.active = true
    JOIN simulation_artifact sim ON sim.id = ssj.simulation_id
    JOIN simulation_flags_junction sf ON sf.simulation_id = sim.id
    JOIN flags_resource f ON f.id = sf.flag_id AND f.name = 'simulation_active' AND sf.value = true
    WHERE x.scenario_id IS NOT NULL
)
SELECT
    -- Basic metadata
    (SELECT scenario_exists FROM scenario_exists_check) as scenario_exists,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    dgd.group_id,

    -- User context for Python permission logic

    -- Scenario state for Python permission logic
    COALESCE((SELECT department_ids FROM scenario_departments_data), ARRAY[]::uuid[]) as scenario_department_ids,
    COALESCE((SELECT active_simulation_count FROM scenario_edit_state), 0)::int as active_simulation_count
FROM params x
CROSS JOIN draft_group_data dgd;
$$;

