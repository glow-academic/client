-- Field Delete Access Check
-- Returns user role and field state for Python to compute delete permissions

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_check_field_delete_access_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_check_field_delete_access_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_check_field_delete_access_v4(
    profile_id uuid,
    field_id uuid
)
RETURNS TABLE (
    -- Field state for Python permission logic
    field_department_ids text[],
    active_parameter_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        profile_id AS profile_id,
        field_id AS field_id
),
-- Get field departments
field_departments_data AS (
    SELECT COALESCE(
        ARRAY_AGG(fd.department_id::text) FILTER (WHERE fd.department_id IS NOT NULL),
        ARRAY[]::text[]
    ) as department_ids
    FROM params x
    LEFT JOIN field_departments_junction fd ON fd.field_id = x.field_id AND fd.active = true
),
-- Count active parameter links (fields linked to parameters via field_conditional_parameters_junction)
parameter_links AS (
    SELECT COUNT(fcpj.conditional_parameters_id)::bigint as active_count
    FROM params x
    LEFT JOIN field_conditional_parameters_junction fcpj ON fcpj.field_id = x.field_id AND fcpj.active = true
)
SELECT
    (SELECT department_ids FROM field_departments_data) as field_department_ids,
    (SELECT active_count FROM parameter_links) as active_parameter_count
FROM params x
$$;

