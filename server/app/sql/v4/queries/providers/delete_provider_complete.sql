-- Delete provider with usage check - checks model_usage_count, deletes if 0
-- Returns usage_count, name, deleted (boolean), actor_name
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
        WHERE proname = 'api_delete_provider_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_provider_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_provider_v4(
    provider_id uuid,
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
    SELECT provider_id AS provider_id,
           profile_id AS profile_id
),
user_profile AS (
    SELECT actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
usage_check AS (
    -- Count distinct models using this provider via provider_models_junction
    SELECT COALESCE(
        (
            SELECT COUNT(DISTINCT pmj.model_id)::bigint
            FROM provider_models_junction pmj
            WHERE pmj.provider_id = (SELECT provider_id FROM params)
        ),
        0
    ) as usage_count
),
provider_info AS (
    SELECT
        (SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.provider_id = p.id LIMIT 1) as name
    FROM params x
    JOIN provider_artifact p ON p.id = x.provider_id
),
delete_result AS (
    DELETE FROM provider_artifact
    WHERE id = (SELECT provider_id FROM params)
      AND (SELECT usage_count FROM usage_check) = 0
      AND EXISTS(SELECT 1 FROM provider_info)
    RETURNING id
)
SELECT
    (SELECT usage_count FROM usage_check) as usage_count,
    (SELECT name FROM provider_info) as name,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END as deleted,
    (SELECT actor_name FROM user_profile) as actor_name
$$;
