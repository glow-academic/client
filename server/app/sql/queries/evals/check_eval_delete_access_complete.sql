-- Eval Delete Access Check
-- Returns user role and eval state for Python to compute delete permissions

-- Drop function if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_eval_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_eval_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_eval_delete_access_v4(
    profile_id uuid,
    eval_id uuid
)
RETURNS TABLE (
    eval_department_ids text[],
    total_usage_links bigint,
    eval_name text
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        eval_id AS eval_id
),
eval_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(ed.department_id::text) FILTER (WHERE ed.department_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN eval_departments_junction ed ON ed.eval_id = x.eval_id AND ed.active = true
),
eval_name_data AS (
    SELECT (SELECT n.name FROM eval_names_junction en JOIN names_resource n ON en.names_id = n.id WHERE en.eval_id = (SELECT eval_id FROM params) LIMIT 1) as eval_name
)
SELECT
    (SELECT department_ids FROM eval_departments) as eval_department_ids,
    0::bigint as total_usage_links,
    (SELECT eval_name FROM eval_name_data) as eval_name
FROM params x
$$;

