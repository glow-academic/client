-- Persona Save Access Check
-- Returns user role and persona state for Python to compute save permissions
-- For update mode: returns user_role, persona_department_ids, active_scenario_count
-- For create mode: returns just user_role (other fields NULL)

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
    -- User context for Python permission logic
    user_role text,
    -- Persona state for Python permission logic (NULL for create mode)
    persona_department_ids text[],
    active_scenario_count bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        persona_id AS persona_id
),
-- Get user profile info
user_profile AS (
    SELECT role
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Get persona edit state (for update mode)
persona_edit_state AS (
    SELECT * FROM view_persona_edit_state WHERE persona_id = (SELECT persona_id FROM params)
)
SELECT
    up.role::text as user_role,
    (SELECT department_ids FROM persona_edit_state) as persona_department_ids,
    COALESCE((SELECT active_scenario_count FROM persona_edit_state), 0)::bigint as active_scenario_count
FROM params x
CROSS JOIN user_profile up;
$$;
