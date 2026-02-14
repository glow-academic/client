-- Persona Access Check (Query 1 of Two-Pass Architecture)
-- Returns user context and persona state for Python to compute permissions
-- This query runs FIRST, before ID fetching

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_persona_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_get_persona_access_v4(
    profile_id uuid,
    persona_id uuid DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    draft_group_id uuid DEFAULT NULL,
    draft_version int DEFAULT NULL
)
RETURNS TABLE (
    persona_exists boolean,
    effective_draft_version int,
    group_id uuid,


    -- Persona state for Python permission logic
    persona_department_ids uuid[],
    active_scenario_count int
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        persona_id AS persona_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
-- Check if persona exists
persona_exists_check AS (
    SELECT
        CASE
            WHEN (SELECT persona_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM persona_artifact WHERE id = (SELECT persona_id FROM params))::boolean
        END as persona_exists
),
-- Create a new group if no draft_group_id provided (guarantees group_id is always returned)
ensure_group AS (
    INSERT INTO groups_entry (created_at, updated_at)
    SELECT NOW(), NOW()
    WHERE draft_group_id IS NULL
    RETURNING id
),
effective_group AS (
    SELECT COALESCE(draft_group_id, (SELECT id FROM ensure_group)) as group_id
),
-- Get persona departments (for access check)
persona_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(pd.department_id ORDER BY pd.created_at) FILTER (WHERE pd.department_id IS NOT NULL),
        ARRAY[]::uuid[]
    ) as department_ids
    FROM params x
    LEFT JOIN persona_departments_junction pd ON pd.persona_id = x.persona_id AND pd.active = true
    WHERE x.persona_id IS NOT NULL
),
-- Get persona edit state (for active_scenario_count)
persona_edit_state AS (
    SELECT * FROM view_persona_edit_state WHERE persona_id = (SELECT persona_id FROM params)
)
SELECT
    -- Basic metadata
    (SELECT persona_exists FROM persona_exists_check) as persona_exists,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    pgd.group_id,

    -- User context for Python permission logic

    -- Persona state for Python permission logic
    COALESCE((SELECT department_ids FROM persona_departments_data), ARRAY[]::uuid[]) as persona_department_ids,
    COALESCE((SELECT active_scenario_count FROM persona_edit_state), 0) as active_scenario_count
FROM params x
CROSS JOIN persona_group_data pgd;
$$;

