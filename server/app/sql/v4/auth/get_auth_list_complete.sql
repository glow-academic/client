-- Get auth list with item counts and permissions
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
        WHERE proname = 'api_get_auth_list_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_auth_list_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITH CASCADE (needed for nested composite types)
-- Drop all types matching prefix pattern to handle type additions/removals
-- CASCADE is needed because outer types contain arrays of inner types
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_auth_list_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_auth_list_v4_auth_item AS (
    auth_item_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_auth_list_v4_auth AS (
    auth_id uuid,
    name text,
    description text,
    active boolean,
    updated_at timestamptz,
    num_items integer,
    sample_items types.q_get_auth_list_v4_auth_item[],
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_auth_list_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    auths types.q_get_auth_list_v4_auth[]
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
auth_item_counts AS (
    SELECT 
        auth_id,
        COUNT(*) as num_items
    FROM auth_items
    GROUP BY auth_id
),
auth_sample_items AS (
    SELECT 
        ai.auth_id,
        ARRAY_AGG(
            (ai.id, ai.name, ai.description)::types.q_get_auth_list_v4_auth_item
            ORDER BY ai.name
        ) as sample_items
    FROM (
        SELECT id, auth_id, name, description,
               ROW_NUMBER() OVER (PARTITION BY auth_id ORDER BY name) as rn
        FROM auth_items
    ) ai
    WHERE ai.rn <= 3
    GROUP BY ai.auth_id
)
SELECT 
    up.actor_name::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (a.id, a.name, a.description, a.active, a.updated_at,
             COALESCE(aic.num_items, 0),
             COALESCE(asi.sample_items, '{}'::types.q_get_auth_list_v4_auth_item[]),
             CASE WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true ELSE false END,
             CASE WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true ELSE false END,
             CASE WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true ELSE false END
            )::types.q_get_auth_list_v4_auth
            ORDER BY a.updated_at DESC NULLS LAST
        ),
        '{}'::types.q_get_auth_list_v4_auth[]
    ) as auths
FROM auth a
LEFT JOIN auth_item_counts aic ON aic.auth_id = a.id
LEFT JOIN auth_sample_items asi ON asi.auth_id = a.id
CROSS JOIN user_profile up
GROUP BY up.actor_name, up.role
$$;

COMMIT;

