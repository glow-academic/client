-- Duplicate auth with items and values in a single transaction
-- Converted to function
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_duplicate_auth_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_auth_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_duplicate_auth_v4(
    auth_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    auth_exists boolean,
    success boolean,
    auth_id uuid,
    original_name text,
    message text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT auth_id AS auth_id,
           profile_id AS profile_id
),
auth_exists_check AS (
    -- Check if auth exists before duplication
    SELECT EXISTS(
        SELECT 1 FROM auth WHERE id = (SELECT auth_id FROM params)
    )::boolean as auth_exists
),
actor_profile AS (
    SELECT 
        x.profile_id as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
source_auth AS (
    SELECT id, name, description, active, auth_type, slug
    FROM params x
    JOIN auth ON auth.id = x.auth_id
),
new_auth AS (
    INSERT INTO auth (
        name,
        description,
        active,
        auth_type,
        slug
    )
    SELECT 
        name || ' (Copy)',
        description,
        active,
        auth_type,
        slug || '-copy'
    FROM source_auth
    RETURNING id as auth_id
),
source_items AS (
    SELECT 
        ai.name,
        ai.description,
        ai.encrypted,
        ai.position,
        ai.active
    FROM source_auth sa
    JOIN auth_items ai ON ai.auth_id = sa.id
),
new_items AS (
    INSERT INTO auth_items (
        auth_id,
        name,
        description,
        encrypted,
        position,
        active
    )
    SELECT 
        na.auth_id,
        si.name,
        si.description,
        si.encrypted,
        si.position,
        si.active
    FROM new_auth na
    CROSS JOIN source_items si
    RETURNING id as item_id
)
SELECT 
    aec.auth_exists::boolean as auth_exists,
    aec.auth_exists::boolean as success,
    na.auth_id,
    sa.name::text as original_name,
    (sa.name || ' duplicated successfully')::text as message,
    ap.actor_name::text as actor_name
FROM auth_exists_check aec
CROSS JOIN actor_profile ap
LEFT JOIN source_auth sa ON true
LEFT JOIN new_auth na ON true
$$;