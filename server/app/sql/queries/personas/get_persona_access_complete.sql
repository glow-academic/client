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
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    persona_exists boolean,
    -- Persona state for Python permission logic
    persona_department_ids uuid[],
    active_scenario_count int
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
-- Group ID creation moved to Python
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
            ELSE EXISTS(SELECT 1 FROM persona_artifact WHERE id = (SELECT persona_id FROM params) AND active = true)::boolean
        END as persona_exists
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
-- Get persona edit state (active_scenario_count via scenario_personas_junction)
persona_edit_state AS (
    SELECT
        COALESCE(COUNT(DISTINCT spj.scenario_id), 0)::int as active_scenario_count
    FROM params x
    LEFT JOIN scenario_personas_junction spj ON spj.persona_id = x.persona_id AND spj.active = true
    WHERE x.persona_id IS NOT NULL
)
SELECT
    (SELECT persona_exists FROM persona_exists_check) as persona_exists,
    COALESCE((SELECT department_ids FROM persona_departments_data), ARRAY[]::uuid[]) as persona_department_ids,
    COALESCE((SELECT active_scenario_count FROM persona_edit_state), 0) as active_scenario_count
FROM params x;
$$;

