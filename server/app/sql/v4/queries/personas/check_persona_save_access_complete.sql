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
    active_scenario_count bigint,
    group_id uuid
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        persona_id AS persona_id
),
-- Get persona edit state (for update mode)
persona_edit_state AS (
    SELECT * FROM view_persona_edit_state WHERE persona_id = (SELECT persona_id FROM params)
),
-- Resolve group_id (most recent active group)
persona_group_data AS (
    SELECT gr.id as group_id
    FROM groups_resource gr
    WHERE gr.active = true
    ORDER BY gr.created_at DESC
    LIMIT 1
)
SELECT
    (SELECT department_ids FROM persona_edit_state) as persona_department_ids,
    COALESCE((SELECT active_scenario_count FROM persona_edit_state), 0)::bigint as active_scenario_count,
    (SELECT group_id FROM persona_group_data) as group_id
FROM params x
$$;

