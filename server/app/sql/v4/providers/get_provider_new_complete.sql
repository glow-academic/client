-- Get default provider structure for new provider creation
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_provider_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_provider_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_provider_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_provider_new_v4(
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
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
    actor_name text,
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        d.payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    AND d.resource_type = 'providers'::draft_resource_type
    LIMIT 1
),
actor_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
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
    -- Default values for new provider (merged with draft payload if draft_id provided)
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        ''::text
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        ''::text
    ) as description,
    COALESCE(
        (SELECT payload->>'value' FROM draft_payload_data),
        ''::text
    ) as value,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        true::boolean
    ) as active,
    NOW()::timestamptz as created_at,
    NOW()::timestamptz as updated_at,
    ''::text as base_url,
    CASE 
        WHEN up.user_role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END::boolean as can_edit,
    CASE 
        WHEN up.user_role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
        ELSE false
    END::boolean as can_delete,
    ap.actor_name::text as actor_name,
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version
FROM user_profile up
CROSS JOIN actor_profile ap
$$;