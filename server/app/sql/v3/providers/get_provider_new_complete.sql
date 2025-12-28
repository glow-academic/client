-- Get default provider structure for new provider creation
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_provider_new_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_provider_new_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_provider_new_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_provider_new_v3(profile_id uuid)
RETURNS TABLE (
    provider_id text,
    name text,
    description text,
    value text,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz,
    base_url text,
    can_edit boolean,
    can_delete boolean,
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
user_profile AS (
    SELECT role as user_role 
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
)
SELECT 
    ''::text as provider_id,
    ''::text as name,
    ''::text as description,
    ''::text as value,
    true::boolean as active,
    NOW()::timestamptz as created_at,
    NOW()::timestamptz as updated_at,
    ''::text as base_url,
    CASE 
        WHEN up.user_role IN ('admin', 'superadmin') THEN true
        ELSE false
    END::boolean as can_edit,
    CASE 
        WHEN up.user_role IN ('admin', 'superadmin') THEN true
        ELSE false
    END::boolean as can_delete,
    ap.actor_name::text as actor_name
FROM user_profile up
CROSS JOIN actor_profile ap
$$;

COMMIT;
