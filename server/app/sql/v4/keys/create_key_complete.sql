-- Create a new key
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
        WHERE proname = 'api_create_key_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_key_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function (no types to drop for create)
CREATE OR REPLACE FUNCTION api_create_key_v4(
    name text,
    key text,
    description text,
    active boolean,
    profile_id uuid,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    key_id uuid,
    key_masked text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        name AS name,
        key AS key,
        COALESCE(NULLIF(description, ''), '') AS description,
        active AS active,
        profile_id AS profile_id,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids
),
user_profile AS (
    SELECT 
        p.role,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
validate_create_permissions AS (
    -- Validate department permissions for create operation
    SELECT validate_department_create_permissions(
        up.role::text,
        ARRAY_AGG(did::text)::text[]
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN params x
    CROSS JOIN unnest(x.department_ids) as did
    GROUP BY up.role
),
actor_profile AS (
    SELECT 
        x.profile_id as resolved_profile_id,
        up.actor_name
    FROM params x
    CROSS JOIN user_profile up
),
new_key AS (
    INSERT INTO keys (
        name,
        key,
        description,
        active
    )
    SELECT name, key, description, active FROM params
    RETURNING id as key_id, key
),
link_departments AS (
    -- NOTE: department_keys table was removed in migration 74
    -- Keys are now linked to departments through settings (setting_provider_keys, setting_auth_keys)
    -- This CTE is kept for compatibility but does nothing
    -- TODO: Reimplement department linking through settings if needed
    SELECT 1 WHERE false
)
SELECT 
    nk.key_id::uuid as key_id,
    CASE 
        WHEN LENGTH(nk.key) > 4 THEN LEFT(nk.key, 4) || '****'
        ELSE '****'
    END::text as key_masked,
    ap.actor_name::text as actor_name
FROM new_key nk
CROSS JOIN actor_profile ap
$$;