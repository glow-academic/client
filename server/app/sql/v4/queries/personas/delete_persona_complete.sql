-- Delete persona with usage check and name fetch - returns usage_count, name, and deleted (boolean)
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
        WHERE proname = 'api_delete_persona_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_persona_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_delete_persona_v4(
    persona_id uuid,
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
    SELECT persona_id AS persona_id,
           profile_id AS profile_id
),
usage_check AS (
    SELECT COUNT(*)::bigint as usage_count
    FROM params x
    JOIN scenario_personas_junction sp ON sp.persona_id = x.persona_id AND sp.active = true
),
persona_info AS (
    SELECT 
        (SELECT n.name FROM persona_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as name
    FROM params x
    JOIN persona_artifact p ON p.id = x.persona_id
),
delete_result AS (
    DELETE FROM persona_artifact 
    WHERE id = (SELECT persona_id FROM params)
      AND (SELECT usage_count FROM usage_check) = 0
      AND EXISTS(SELECT 1 FROM persona_info)
    RETURNING id
)
SELECT 
    (SELECT usage_count FROM usage_check) as usage_count,
    (SELECT name FROM persona_info) as name,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted
$$;
