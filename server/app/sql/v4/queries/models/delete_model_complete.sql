-- Delete model with usage checks (personas and agents) and name fetch
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_delete_model_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_delete_model_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_delete_model_v4(
    model_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    model_exists boolean,
    deleted boolean,
    name text,
    actor_name text,
    personas_usage_count bigint,
    agents_usage_count bigint
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT model_id AS model_id, profile_id AS profile_id
),
model_exists_check AS (
    SELECT EXISTS(SELECT 1 FROM model_artifact WHERE id = (SELECT model_id FROM params))::boolean as model_exists
),
actor_profile AS (
    SELECT 
        (SELECT profile_id FROM params)::uuid as profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ''), 'System') as actor_name
    FROM profile_artifact p
    WHERE p.id = (SELECT profile_id FROM params)::uuid
),
personas_usage_check AS (
    -- Personas are no longer directly linked to models (persona_text_model dropped in migration 44)
    -- So there's no direct usage check needed for personas
    SELECT 0::bigint as usage_count
),
agents_usage_check AS (
    SELECT COUNT(DISTINCT amj.agent_id)::bigint as usage_count
    FROM agent_models_junction amj
    WHERE amj.model_id = (SELECT model_id FROM params)
      AND amj.active = true
),
model_info AS (
    SELECT 
        (SELECT n.name FROM model_names_junction mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) as name
    FROM model_artifact m
    WHERE m.id = (SELECT model_id FROM params)
),
delete_result AS (
    DELETE FROM model_artifact 
    WHERE id = (SELECT model_id FROM params)
      AND (SELECT usage_count FROM personas_usage_check) = 0
      AND (SELECT usage_count FROM agents_usage_check) = 0
      AND EXISTS(SELECT 1 FROM model_info)
    RETURNING id
)
SELECT 
    mec.model_exists::boolean as model_exists,
    CASE WHEN EXISTS(SELECT 1 FROM delete_result) THEN true ELSE false END::boolean as deleted,
    COALESCE(mi.name, '')::text as name,
    ap.actor_name::text as actor_name,
    (SELECT usage_count FROM personas_usage_check)::bigint as personas_usage_count,
    (SELECT usage_count FROM agents_usage_check)::bigint as agents_usage_count
FROM model_exists_check mec
CROSS JOIN actor_profile ap
LEFT JOIN model_info mi ON true
$$;
