-- Persona Delete Access Check
-- Returns user role and persona state for Python to compute delete permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_persona_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_persona_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_persona_delete_access_v4(
    profile_id uuid,
    persona_id uuid
)
RETURNS TABLE (
    -- User context for Python permission logic
    user_role text,
    -- Persona state for Python permission logic
    persona_department_ids text[],
    total_scenario_links bigint
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
-- Get persona departments
persona_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(pd.department_id::text) FILTER (WHERE pd.department_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN persona_departments_junction pd ON pd.persona_id = x.persona_id
),
-- Count total scenario links (active or not)
-- NOTE: Must use COUNT(column) not COUNT(*) with LEFT JOIN, as COUNT(*)
-- counts the NULL row when there are no matches
scenario_links AS (
    SELECT COUNT(sp.persona_id)::bigint as total_links
    FROM params x
    LEFT JOIN scenario_personas_junction sp ON sp.persona_id = x.persona_id
)
SELECT
    up.role::text as user_role,
    (SELECT department_ids FROM persona_departments_data) as persona_department_ids,
    (SELECT total_links FROM scenario_links) as total_scenario_links
FROM params x
CROSS JOIN user_profile up;
$$;
