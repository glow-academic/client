-- Get auth detail with items (values managed separately in settings)
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
        WHERE proname = 'api_get_auth_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_auth_detail_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_auth_detail_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_auth_detail_v4_auth_item AS (
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
CREATE OR REPLACE FUNCTION api_get_auth_detail_v4(
    auth_id uuid,
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    auth_exists boolean,
    name text,
    description text,
    active boolean,
    can_edit boolean,
    auth_items types.q_get_auth_detail_v4_auth_item[],
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
        auth_id AS auth_id,
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
    AND d.resource_type = 'auth'::draft_resource_type
    LIMIT 1
),
auth_exists_check AS (
    -- Check if auth exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM auth WHERE id = (SELECT auth_id FROM params)
    )::boolean as auth_exists
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
        -- Merge draft payload with auth data (draft takes precedence)
        COALESCE(
            (SELECT payload->>'name' FROM draft_payload_data),
            a.name
        ) as name,
        COALESCE(
            (SELECT payload->>'description' FROM draft_payload_data),
            a.description
        ) as description,
        COALESCE(
            (SELECT (payload->>'active')::boolean FROM draft_payload_data),
            a.active
        ) as active,
        CASE 
            WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_edit
    FROM params x
    JOIN auth a ON a.id = x.auth_id
    CROSS JOIN user_profile up
),
auth_items_data AS (
    -- Get all auth items (values managed separately in settings page)
    SELECT 
        ai.id as auth_item_id,
        ai.name,
        ai.description,
        ai.position,
        ai.active,
        ai.encrypted,
        NULL::text as key_id,
        CASE 
            WHEN ai.encrypted THEN '****'::text
            ELSE ''::text
        END as value_masked
    FROM params x
    JOIN auth_items ai ON ai.auth_id = x.auth_id
    ORDER BY ai.position
)
SELECT 
    aec.auth_exists::boolean as auth_exists,
    ad.name::text as name,
    ad.description::text as description,
    ad.active::boolean as active,
    ad.can_edit::boolean as can_edit,
    COALESCE(
        ARRAY_AGG(
            (aid.auth_item_id, aid.name, aid.description, aid.position, aid.active, aid.value_masked, aid.key_id, aid.encrypted)::types.q_get_auth_detail_v4_auth_item
            ORDER BY aid.position
        ),
        '{}'::types.q_get_auth_detail_v4_auth_item[]
    ) as auth_items,
    up.actor_name::text as actor_name,
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version,
    -- Extract auth_item_ids from draft payload if available, otherwise extract from auth_items array
    COALESCE(
        (SELECT payload->'authItemIds' FROM draft_payload_data),
        (SELECT payload->'auth_item_ids' FROM draft_payload_data),
        (SELECT COALESCE(jsonb_agg(aid.auth_item_id::text ORDER BY aid.position), '[]'::jsonb) FROM auth_items_data aid),
        '[]'::jsonb
    ) as auth_item_ids,
    -- Extract auth_item_active_states from draft payload if available, otherwise extract from auth_items array
    COALESCE(
        (SELECT payload->'authItemActiveStates' FROM draft_payload_data),
        (SELECT payload->'auth_item_active_states' FROM draft_payload_data),
        (SELECT COALESCE(jsonb_object_agg(aid.auth_item_id::text, aid.active), '{}'::jsonb) FROM auth_items_data aid),
        '{}'::jsonb
    ) as auth_item_active_states,
    -- Extract auth_item_encrypted_states from draft payload if available, otherwise extract from auth_items array
    COALESCE(
        (SELECT payload->'authItemEncryptedStates' FROM draft_payload_data),
        (SELECT payload->'auth_item_encrypted_states' FROM draft_payload_data),
        (SELECT COALESCE(jsonb_object_agg(aid.auth_item_id::text, aid.encrypted), '{}'::jsonb) FROM auth_items_data aid),
        '{}'::jsonb
    ) as auth_item_encrypted_states
FROM auth_exists_check aec
CROSS JOIN user_profile up
LEFT JOIN auth_data ad ON true
LEFT JOIN auth_items_data aid ON true
GROUP BY aec.auth_exists, ad.name, ad.description, ad.active, ad.can_edit, up.actor_name
$$;