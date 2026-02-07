-- Model Save Access Check
-- Returns user role, user departments, and model state for Python to compute save permissions
-- For update mode: returns user_role, user_department_ids, model_department_ids, active_persona_count
-- For create mode: returns user_role, user_department_ids (model fields NULL)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_model_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_model_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_model_save_access_v4(
    profile_id uuid,
    model_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- User context for Python permission logic
    user_role text,
    user_department_ids text[],
    -- Model state for Python permission logic (NULL for create mode)
    model_department_ids text[],
    active_persona_count bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        model_id AS model_id
),
-- Get user profile info
user_profile AS (
    SELECT role
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
-- Get user's departments
user_departments AS (
    SELECT COALESCE(ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at), ARRAY[]::text[]) as department_ids
    FROM params x
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Get model departments (for update mode)
model_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(md.department_id::text) FILTER (WHERE md.department_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN model_departments_junction md ON md.model_id = x.model_id AND md.active = true
    WHERE x.model_id IS NOT NULL
),
-- Persona-model direct link removed (migration 44)
-- Always returns 0 since personas are no longer directly linked to models
model_persona_count AS (
    SELECT 0::bigint as active_persona_count
)
SELECT
    up.role::text as user_role,
    ud.department_ids as user_department_ids,
    (SELECT department_ids FROM model_departments_data) as model_department_ids,
    COALESCE((SELECT active_persona_count FROM model_persona_count), 0)::bigint as active_persona_count
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud;
$$;
