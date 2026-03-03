-- Delete field with usage check and name fetch - returns usage_count, name, and deleted (boolean)
-- Converted to function
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_delete_field_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_field_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_delete_field_v4(
    field_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    usage_count bigint,
    name text,
    deleted boolean
)
LANGUAGE sql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT
        field_id AS field_id,
        profile_id AS profile_id
),
usage_check AS (
    SELECT COUNT(fcpj.conditional_parameter_id)::bigint as usage_count
    FROM params x
    LEFT JOIN field_conditional_parameters_junction fcpj
        ON fcpj.field_id = x.field_id AND fcpj.active = true
),
field_info AS (
    SELECT
        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.id LIMIT 1) as name
    FROM params x
    JOIN field_artifact f ON f.id = x.field_id
),
delete_result AS (
    DELETE FROM field_artifact
    WHERE id = (SELECT field_id FROM params)
      AND (SELECT usage_count FROM usage_check) = 0
      AND EXISTS(SELECT 1 FROM field_info)
    RETURNING id
)
SELECT
    (SELECT usage_count FROM usage_check) as usage_count,
    (SELECT name FROM field_info) as name,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted
$$;

