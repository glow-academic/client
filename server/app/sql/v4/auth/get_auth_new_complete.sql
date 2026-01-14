-- Get default auth detail for creation mode
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
        WHERE proname = 'api_get_auth_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_auth_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_auth_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_auth_new_v4_auth_item AS (
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
CREATE OR REPLACE FUNCTION api_get_auth_new_v4(
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    name text,
    description text,
    active boolean,
    can_edit boolean,
    auth_items types.q_get_auth_new_v4_auth_item[],
    actor_name text,
    draft_version int,
    auth_item_ids jsonb,
    auth_item_active_states jsonb,
    auth_item_encrypted_states jsonb
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
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    
    LIMIT 1
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
auth_data AS (
    SELECT 
        COALESCE(
            (SELECT payload->>'name' FROM draft_payload_data),
            ''::text
        ) as name,
        COALESCE(
            (SELECT payload->>'description' FROM draft_payload_data),
            ''::text
        ) as description,
        COALESCE(
            (SELECT (payload->>'active')::boolean FROM draft_payload_data),
            false::boolean
        ) as active,
        CASE 
            WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_edit
    FROM user_profile up
)
SELECT 
    ad.name::text as name,
    ad.description::text as description,
    ad.active::boolean as active,
    ad.can_edit::boolean as can_edit,
    '{}'::types.q_get_auth_new_v4_auth_item[] as auth_items,
    up.actor_name::text as actor_name,
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version,
    -- Extract auth_item_ids from draft payload if available
    COALESCE(
        (SELECT payload->'authItemIds' FROM draft_payload_data),
        (SELECT payload->'auth_item_ids' FROM draft_payload_data),
        '[]'::jsonb
    ) as auth_item_ids,
    -- Extract auth_item_active_states from draft payload if available
    COALESCE(
        (SELECT payload->'authItemActiveStates' FROM draft_payload_data),
        (SELECT payload->'auth_item_active_states' FROM draft_payload_data),
        '{}'::jsonb
    ) as auth_item_active_states,
    -- Extract auth_item_encrypted_states from draft payload if available
    COALESCE(
        (SELECT payload->'authItemEncryptedStates' FROM draft_payload_data),
        (SELECT payload->'auth_item_encrypted_states' FROM draft_payload_data),
        '{}'::jsonb
    ) as auth_item_encrypted_states
FROM auth_data ad
CROSS JOIN user_profile up
$$;