-- Get default auth detail for creation mode
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
        WHERE proname = 'api_get_auth_new_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_auth_new_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_auth_new_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_auth_new_v3_auth_item AS (
    auth_item_id uuid,
    name text,
    description text,
    position integer,
    active boolean,
    value_masked text,
    key_id text,
    encrypted boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_auth_new_v3(profile_id uuid)
RETURNS TABLE (
    name text,
    description text,
    active boolean,
    can_edit boolean,
    auth_items types.q_get_auth_new_v3_auth_item[],
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
auth_data AS (
    SELECT 
        ''::text as name,
        ''::text as description,
        false::boolean as active,
        CASE 
            WHEN up.role IN (profile_role.admin, profile_role.superadmin) THEN true
            ELSE false
        END as can_edit
    FROM user_profile up
)
SELECT 
    ad.name::text as name,
    ad.description::text as description,
    ad.active::boolean as active,
    ad.can_edit::boolean as can_edit,
    '{}'::types.q_get_auth_new_v3_auth_item[] as auth_items,
    up.actor_name::text as actor_name
FROM auth_data ad
CROSS JOIN user_profile up
$$;

COMMIT;

