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
    deleted boolean,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT persona_id AS persona_id,
           profile_id AS profile_id
),
user_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
),
usage_check AS (
    SELECT COUNT(*)::bigint as usage_count
    FROM params x
    JOIN scenario_personas sp ON sp.persona_id = x.persona_id AND sp.active = true
),
persona_info AS (
    SELECT 
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as name
    FROM params x
    JOIN personas p ON p.id = x.persona_id
),
delete_result AS (
    DELETE FROM persona 
    WHERE id = (SELECT persona_id FROM params)
      AND (SELECT usage_count FROM usage_check) = 0
      AND EXISTS(SELECT 1 FROM persona_info)
    RETURNING id
)
SELECT 
    (SELECT usage_count FROM usage_check) as usage_count,
    (SELECT name FROM persona_info) as name,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted,
    (SELECT actor_name FROM user_profile) as actor_name
$$;