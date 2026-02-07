-- Model Delete Access Check
-- Returns user role and model state for Python to compute delete permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_model_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_model_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_model_delete_access_v4(
    profile_id uuid,
    model_id uuid
)
RETURNS TABLE (
    -- User context for Python permission logic
    user_role text,
    -- Model state for Python permission logic
    model_department_ids text[],
    total_persona_links bigint,
    agents_usage_count bigint
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
-- Get model departments
model_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(md.department_id::text) FILTER (WHERE md.department_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN model_departments_junction md ON md.model_id = x.model_id AND md.active = true
),
-- Persona-model direct link removed (migration 44)
-- Always returns 0 since personas are no longer directly linked to models
persona_links AS (
    SELECT 0::bigint as total_links
),
-- Count agent usage
agent_links AS (
    SELECT COUNT(am.agent_id)::bigint as total_links
    FROM params x
    LEFT JOIN agent_models_junction am ON am.model_id = x.model_id
)
SELECT
    up.role::text as user_role,
    (SELECT department_ids FROM model_departments_data) as model_department_ids,
    (SELECT total_links FROM persona_links) as total_persona_links,
    (SELECT total_links FROM agent_links) as agents_usage_count
FROM params x
CROSS JOIN user_profile up;
$$;
