-- Eval Save Access Check
-- Returns user role, user departments, and eval state for Python to compute save permissions

-- Drop function if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_eval_save_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_eval_save_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_eval_save_access_v4(
    profile_id uuid,
    eval_id uuid DEFAULT NULL
)
RETURNS TABLE (
    user_role text,
    user_department_ids text[],
    eval_department_ids text[],
    active_usage_count bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id AS profile_id,
        eval_id AS eval_id
),
user_profile AS (
    SELECT role
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
user_departments AS (
    SELECT COALESCE(ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at), ARRAY[]::text[]) as department_ids
    FROM params x
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = x.profile_id AND pd.active = true
),
eval_departments AS (
    SELECT COALESCE(
        ARRAY_AGG(ed.department_id::text) FILTER (WHERE ed.department_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN eval_departments_junction ed ON ed.eval_id = x.eval_id AND ed.active = true
    WHERE x.eval_id IS NOT NULL
)
SELECT
    up.role::text as user_role,
    ud.department_ids as user_department_ids,
    (SELECT department_ids FROM eval_departments) as eval_department_ids,
    0::bigint as active_usage_count
FROM params x
CROSS JOIN user_profile up
CROSS JOIN user_departments ud;
$$;
