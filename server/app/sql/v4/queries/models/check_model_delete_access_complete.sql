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
    -- Model state for Python permission logic
    model_department_ids text[],
    active_agent_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        model_id AS model_id
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
-- Count active agent links (immediate parent only)
agent_links AS (
    SELECT COUNT(am.agent_id)::bigint as active_count
    FROM params x
    LEFT JOIN agent_models_junction am ON am.model_id = x.model_id AND am.active = true
)
SELECT
    (SELECT department_ids FROM model_departments_data) as model_department_ids,
    (SELECT active_count FROM agent_links) as active_agent_count
FROM params x
$$;

