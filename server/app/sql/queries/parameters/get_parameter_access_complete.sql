-- Parameter Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and parameter state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_parameter_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_parameter_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_parameter_access_v4(
    profile_id uuid,
    parameter_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    draft_group_id uuid DEFAULT NULL,
    draft_version int DEFAULT NULL
)
RETURNS TABLE (
    parameter_exists boolean,
    effective_draft_version int,
    group_id uuid,


    -- Parameter state for Python permission logic
    parameter_department_ids uuid[],
    active_scenario_count int
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        parameter_id AS parameter_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Check if parameter exists
parameter_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT parameter_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM parameter_artifact WHERE id = (SELECT parameter_id FROM params))::boolean
        END as parameter_exists
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
-- Get parameter departments (for access check)
parameter_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(pd.departments_id ORDER BY pd.created_at) FILTER (WHERE pd.departments_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN parameter_departments_junction pd ON pd.parameter_id = x.parameter_id AND pd.active = true
    WHERE x.parameter_id IS NOT NULL
),
-- Get parameter edit state (active_scenario_count via parameter_fields -> scenario_parameter_fields)
parameter_edit_state AS (
    SELECT
        COALESCE(COUNT(DISTINCT spf.scenario_id), 0)::int as active_scenario_count
    FROM params x
    LEFT JOIN parameter_fields_resource pfr ON pfr.parameter_id = x.parameter_id AND pfr.active = true
    LEFT JOIN scenario_parameter_fields_junction spf ON spf.parameter_fields_id = pfr.id AND spf.active = true
    WHERE x.parameter_id IS NOT NULL
)
SELECT
    -- Basic metadata
    (SELECT parameter_exists FROM parameter_exists_check) as parameter_exists,
    draft_version as effective_draft_version,
    (SELECT group_id FROM effective_group) as group_id,

    -- User context for Python permission logic

    -- Parameter state for Python permission logic
    COALESCE((SELECT department_ids FROM parameter_departments_data), ARRAY[]::uuid[]) as parameter_department_ids,
    COALESCE((SELECT active_scenario_count FROM parameter_edit_state), 0) as active_scenario_count
FROM params x;
$$;

