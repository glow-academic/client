-- Delete eval with usage check and name fetch
-- Returns eval_id, eval_name, actor_name, deleted (boolean)

-- Drop function if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_delete_eval_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_eval_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_delete_eval_v4(
    eval_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    eval_id uuid,
    eval_name text,
    actor_name text,
    deleted boolean,
    usage_count bigint
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT eval_id AS eval_id,
           profile_id AS profile_id
),
user_profile AS (
    SELECT actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
eval_info AS (
    SELECT
        (SELECT n.name FROM eval_names_junction en JOIN names_resource n ON en.name_id = n.id WHERE en.eval_id = e.id LIMIT 1) as name
    FROM params x
    JOIN eval_artifact e ON e.id = x.eval_id
),
delete_result AS (
    DELETE FROM eval_artifact
    WHERE id = (SELECT eval_id FROM params)
      AND EXISTS(SELECT 1 FROM eval_info)
    RETURNING id
)
SELECT
    COALESCE((SELECT id FROM delete_result), (SELECT eval_id FROM params)) as eval_id,
    (SELECT name FROM eval_info) as eval_name,
    (SELECT actor_name FROM user_profile) as actor_name,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted,
    0::bigint as usage_count
$$;
