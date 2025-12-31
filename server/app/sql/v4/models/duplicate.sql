-- Duplicate model with profile_id for auditing
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_duplicate_model_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_model_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_duplicate_model_v4(
    model_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    model_exists boolean,
    model_id uuid,
    original_name text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT model_id AS model_id, profile_id AS profile_id
),
model_exists_check AS (
    SELECT EXISTS(SELECT 1 FROM models WHERE id = (SELECT model_id FROM params))::boolean as model_exists
),
actor_profile AS (
    SELECT 
        (SELECT profile_id FROM params)::uuid as profile_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.id = (SELECT profile_id FROM params)::uuid
),
source_model AS (
    SELECT 
        name,
        description,
        active,
        provider_id
    FROM models
    WHERE id = (SELECT model_id FROM params)
),
duplicated_model AS (
    INSERT INTO models (
        provider_id,
        name,
        description,
        active
    )
    SELECT 
        sm.provider_id,
        sm.name,
        sm.description || ' Copy',
        sm.active
    FROM source_model sm
    WHERE EXISTS(SELECT 1 FROM model_exists_check WHERE model_exists = true)
    RETURNING id
)
SELECT 
    mec.model_exists::boolean as model_exists,
    dm.id as model_id,
    sm.name::text as original_name,
    ap.actor_name::text as actor_name
FROM model_exists_check mec
CROSS JOIN actor_profile ap
LEFT JOIN source_model sm ON mec.model_exists = true
LEFT JOIN duplicated_model dm ON mec.model_exists = true
LIMIT 1
$$;

COMMIT;
