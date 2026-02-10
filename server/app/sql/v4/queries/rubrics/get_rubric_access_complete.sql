-- Rubric Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and rubric state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_rubric_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_rubric_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_rubric_access_v4(
    profile_id uuid,
    rubric_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Basic metadata
    actor_name text,
    rubric_exists boolean,
    draft_version int,
    group_id uuid,

    -- User context for Python permission logic
    user_role text,
    user_department_ids uuid[],

    -- Rubric state for Python permission logic
    rubric_department_ids uuid[],
    active_simulation_count int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        rubric_id AS rubric_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Check if rubric exists
rubric_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT rubric_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM rubric_artifact WHERE id = (SELECT rubric_id FROM params))::boolean
        END as rubric_exists
),
-- Get user profile info
user_profile AS (
    SELECT role, actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Get user's departments
user_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(DISTINCT pd.department_id) FILTER (WHERE pd.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Resolve canonical rubric group context (draft override handled in Python service layer)
rubric_group_data AS (
    SELECT
        (
            SELECT gr.id
            FROM groups_resource gr
            WHERE gr.active = true
            ORDER BY gr.created_at DESC
            LIMIT 1
        ) as group_id
    FROM params x
    WHERE TRUE
    LIMIT 1
),
-- Draft version is resolved in Python via internal draft fetch layer
draft_version_data AS (
    SELECT NULL::int as draft_version
),
-- Get rubric departments (for access check)
rubric_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(rd.department_id ORDER BY rd.created_at) FILTER (WHERE rd.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN rubric_departments_junction rd ON rd.rubric_id = x.rubric_id AND rd.active = true
    WHERE x.rubric_id IS NOT NULL
),
-- Get active simulation count for rubric (for Python permission logic)
rubric_active_simulation_count AS (
    SELECT COALESCE(
        (SELECT COUNT(DISTINCT ss.simulation_id)::int
         FROM simulation_scenarios_junction ss
         JOIN simulation_scenario_rubrics_junction ssr ON ssr.simulation_id = ss.simulation_id
         JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubric_id AND srr.scenario_id = ss.scenario_id
         WHERE srr.rubric_id = (SELECT rubric_id FROM params)
           AND EXISTS (
               SELECT 1 FROM simulation_scenario_flags_junction ssf
               JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id
               JOIN flags_resource f ON sfr.flag_id = f.id
               WHERE ssf.simulation_id = ss.simulation_id
                 AND sfr.scenario_id = ss.scenario_id
                 AND f.name = 'scenario_active'
                 AND ssf.value = true
           )
        ),
        0
    ) as count
)
SELECT
    -- Basic metadata
    up.actor_name::text as actor_name,
    (SELECT rubric_exists FROM rubric_exists_check) as rubric_exists,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    rgd.group_id,

    -- User context for Python permission logic
    up.role::text as user_role,
    ud.department_ids as user_department_ids,

    -- Rubric state for Python permission logic
    COALESCE((SELECT department_ids FROM rubric_departments_data), ARRAY[]::uuid[]) as rubric_department_ids,
    (SELECT count FROM rubric_active_simulation_count)::int as active_simulation_count
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud
CROSS JOIN rubric_group_data rgd;
$$;
