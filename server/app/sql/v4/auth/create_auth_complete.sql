-- Create auth with items (encrypted items use keys, values managed separately in settings)
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
        WHERE proname = 'api_create_auth_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_auth_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_create_auth_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_create_auth_v4_auth_item AS (
    name text,
    description text,
    encrypted boolean,
    position integer,
    active boolean,
    key_id uuid  -- NULL allowed by default in PostgreSQL
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_create_auth_v4(
    name text,
    description text,
    active boolean,
    auth_type text,
    slug text,
    profile_id uuid,
    auth_items types.i_create_auth_v4_auth_item[] DEFAULT ARRAY[]::types.i_create_auth_v4_auth_item[]
)
RETURNS TABLE (
    success boolean,
    auth_id uuid,
    name text,
    message text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        name AS name,
        description AS description,
        active AS active,
        auth_type AS auth_type,
        COALESCE(NULLIF(slug, ''), lower(replace(name, ' ', '-'))) AS slug,
        profile_id AS profile_id,
        COALESCE(auth_items, ARRAY[]::types.i_create_auth_v4_auth_item[]) AS auth_items
),
actor_profile AS (
    SELECT 
        x.profile_id as resolved_profile_id,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
-- Insert name INTO names_resource table and get ID
name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    FROM params
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description INTO descriptions_resource table and get ID
description_resource AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
-- Insert or get protocol
protocol_resource AS (
    INSERT INTO protocols_resource (value, created_at, updated_at)
    SELECT auth_type, NOW(), NOW()
    FROM params
    WHERE auth_type IS NOT NULL AND auth_type != ''
    ON CONFLICT (value) DO UPDATE SET updated_at = NOW()
    RETURNING id as protocol_id
),
-- Insert or get slug
slug_resource AS (
    INSERT INTO slugs_resource (value, created_at, updated_at)
    SELECT slug, NOW(), NOW()
    FROM params
    WHERE slug IS NOT NULL AND slug != ''
    ON CONFLICT (value) DO UPDATE SET updated_at = NOW()
    RETURNING id as slug_id
),
new_auth AS (
    -- Create auth (no columns needed - all data in junction tables)
    INSERT INTO auths_resource (id)
    SELECT uuidv7()
    FROM params
    RETURNING id as auth_id
),
-- Link auth to protocol
link_auth_protocol AS (
    INSERT INTO auth_protocols (auth_id, protocol_id, created_at, updated_at)
    SELECT 
        na.auth_id,
        pr.protocol_id,
        NOW(),
        NOW()
    FROM new_auth na
    CROSS JOIN protocol_resource pr
    ON CONFLICT (auth_id, protocol_id) DO UPDATE SET updated_at = NOW()
),
-- Link auth to slug
link_auth_slug AS (
    INSERT INTO auth_slugs (auth_id, slug_id, created_at, updated_at)
    SELECT 
        na.auth_id,
        sr.slug_id,
        NOW(),
        NOW()
    FROM new_auth na
    CROSS JOIN slug_resource sr
    ON CONFLICT (auth_id, slug_id) DO UPDATE SET updated_at = NOW()
),
-- Link auth to name
link_auth_name AS (
    INSERT INTO auth_names (auth_id, name_id, created_at, updated_at)
    SELECT 
        na.auth_id,
        nr.name_id,
        NOW(),
        NOW()
    FROM new_auth na
    CROSS JOIN name_resource nr
    ON CONFLICT (auth_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link auth to description
link_auth_description AS (
    INSERT INTO auth_descriptions (auth_id, description_id, created_at, updated_at)
    SELECT 
        na.auth_id,
        dr.description_id,
        NOW(),
        NOW()
    FROM new_auth na
    CROSS JOIN description_resource dr
    ON CONFLICT (auth_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link auth active flag
link_auth_active_flag AS (
    INSERT INTO auth_flags (auth_id, flag_id, value, created_at, updated_at) SELECT na.auth_id,
        f.id,
        (SELECT active FROM params),
        NOW(),
        NOW()
    FROM new_auth na
    CROSS JOIN params p
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
    ON CONFLICT (auth_id, flag_id) DO UPDATE SET 
        value = (SELECT active FROM params),
        updated_at = NOW()
),
items_expanded AS (
    -- Expand composite type array with row numbers for matching
    SELECT 
        row_number() OVER () as item_idx,
        item.name as item_name,
        item.description as item_description,
        COALESCE(item.encrypted, true) as item_encrypted,
        COALESCE(item.position, row_number() OVER ()) as item_position,
        COALESCE(item.active, true) as item_active,
        item.key_id as item_key_id
    FROM params x
    CROSS JOIN LATERAL unnest(x.auth_items) AS item
),
new_items AS (
    -- Create all items (standalone table) - one per auth item
    INSERT INTO items_resource (
        name,
        description,
        encrypted,
        position,
        active,
        created_at,
        updated_at
    )
    SELECT 
        ie.item_name,
        ie.item_description,
        ie.item_encrypted,
        ie.item_position,
        ie.item_active,
        NOW(),
        NOW()
    FROM items_expanded ie
    RETURNING id as item_id
),
items_with_idx AS (
    -- Match created items back to their expanded data using row numbers
    SELECT 
        ROW_NUMBER() OVER (ORDER BY ni.item_id) as item_idx,
        ni.item_id
    FROM new_items ni
),
-- Link auth to items via junction table
link_auth_items AS (
    INSERT INTO auth_items (auth_id, item_id, created_at, updated_at)
    SELECT 
        na.auth_id,
        iwi.item_id,
        NOW(),
        NOW()
    FROM new_auth na
    CROSS JOIN items_expanded ie
    JOIN items_with_idx iwi ON iwi.item_idx = ie.item_idx
    ON CONFLICT (auth_id, item_id) DO UPDATE SET updated_at = NOW()
),
link_encrypted_keys AS (
    -- NOTE: auth_item_keys table was removed in migration 74
    -- Keys are now linked through settings (setting_auth_keys, setting_provider_keys)
    -- This CTE is kept for compatibility but does nothing
    SELECT 1 WHERE false
)
SELECT 
    true::boolean as success,
    na.auth_id,
    (SELECT n.name FROM names_resource n JOIN name_resource nr ON n.id = nr.name_id LIMIT 1) as name,
    ((SELECT n.name FROM names_resource n JOIN name_resource nr ON n.id = nr.name_id LIMIT 1) || ' created successfully')::text as message,
    ap.actor_name
FROM new_auth na
CROSS JOIN actor_profile ap
$$;