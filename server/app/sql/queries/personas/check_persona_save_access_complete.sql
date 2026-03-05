-- Persona Save Access Check
-- Returns user role, user departments, and persona state for Python to compute save permissions
-- For update mode: returns user_role, user_department_ids, persona_department_ids, active_scenario_count
-- For create mode: returns user_role, user_department_ids (persona fields NULL)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_persona_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_persona_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_persona_save_access_v4(
    profile_id uuid,
    persona_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Persona state for Python permission logic (NULL for create mode)
    persona_department_ids text[],
    active_scenario_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
-- Group ID creation moved to Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        persona_id AS persona_id
),
-- Get persona departments (for update mode)
persona_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(pd.departments_id::text ORDER BY pd.created_at) FILTER (WHERE pd.departments_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN persona_departments_junction pd ON pd.persona_id = x.persona_id AND pd.active = true
    WHERE x.persona_id IS NOT NULL
),
-- Get persona edit state (active_scenario_count via scenario_personas_junction)
persona_edit_state AS (
    SELECT
        COALESCE(COUNT(DISTINCT spj.scenario_id), 0)::bigint as active_scenario_count
    FROM params x
    LEFT JOIN scenario_personas_junction spj ON spj.personas_id = x.persona_id AND spj.active = true
    WHERE x.persona_id IS NOT NULL
)
SELECT
    COALESCE((SELECT department_ids FROM persona_departments_data), ARRAY[]::text[]) as persona_department_ids,
    COALESCE((SELECT active_scenario_count FROM persona_edit_state), 0)::bigint as active_scenario_count
FROM params x
$$;

