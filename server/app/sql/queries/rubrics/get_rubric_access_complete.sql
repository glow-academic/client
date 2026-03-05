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
    draft_id uuid DEFAULT NULL,
    draft_group_id uuid DEFAULT NULL,
    draft_version int DEFAULT NULL
)
RETURNS TABLE (
    rubric_exists boolean,
    effective_draft_version int,
    group_id uuid,


    -- Rubric state for Python permission logic
    rubric_department_ids uuid[],
    active_simulation_count int
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
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
-- Create a new group if no draft_group_id provided (guarantees group_id is always returned)
ensure_group AS (
    INSERT INTO groups_entry (created_at)
    SELECT NOW()
    WHERE draft_group_id IS NULL
    RETURNING id
),
effective_group AS (
    SELECT COALESCE(draft_group_id, (SELECT id FROM ensure_group)) as group_id
),
-- Get rubric departments (for access check)
rubric_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(rd.departments_id ORDER BY rd.created_at) FILTER (WHERE rd.departments_id IS NOT NULL),
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
         JOIN scenario_rubrics_resource srr ON srr.id = ssr.scenario_rubrics_id AND srr.scenario_id = ss.scenario_id
         WHERE srr.rubric_id = (SELECT rubric_id FROM params)
           AND EXISTS (
               SELECT 1 FROM simulation_scenario_flags_junction ssf
               JOIN scenario_flags_resource sfr ON ssf.scenario_flags_id = sfr.id
               JOIN flags_resource f ON sfr.flag_id = f.id
               WHERE ssf.simulation_id = ss.simulation_id
                 AND sfr.scenario_id = ss.scenario_id
                 AND f.type = 'scenario_active'
                 AND f.value = true
           )
        ),
        0
    ) as count
)
SELECT
    -- Basic metadata
    (SELECT rubric_exists FROM rubric_exists_check) as rubric_exists,
    draft_version as effective_draft_version,
    (SELECT group_id FROM effective_group) as group_id,

    -- User context for Python permission logic

    -- Rubric state for Python permission logic
    COALESCE((SELECT department_ids FROM rubric_departments_data), ARRAY[]::uuid[]) as rubric_department_ids,
    (SELECT count FROM rubric_active_simulation_count)::int as active_simulation_count
FROM params x;
$$;

