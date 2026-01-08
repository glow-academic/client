-- Update auth with items (encrypted items use keys, values managed separately in settings)
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
        WHERE proname = 'api_update_auth_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_auth_v4(%s)', r.sig);
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
        WHERE typname LIKE 'i_update_auth_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_update_auth_v4_auth_item AS (
    name text,
    description text,
    encrypted boolean,
    position integer,
    active boolean,
    key_id uuid  -- NULL allowed by default in PostgreSQL
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_update_auth_v4(
    auth_id uuid,
    name text,
    description text,
    active boolean,
    auth_type text,
    slug text,
    profile_id uuid,
    auth_items types.i_update_auth_v4_auth_item[] DEFAULT ARRAY[]::types.i_update_auth_v4_auth_item[]
)
RETURNS TABLE (
    auth_exists boolean,
    success boolean,
    name text,
    message text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        auth_id AS auth_id,
        name AS name,
        description AS description,
        active AS active,
        auth_type AS auth_type,
        COALESCE(NULLIF(slug, ''), lower(replace(name, ' ', '-'))) AS slug,
        profile_id AS profile_id,
        COALESCE(auth_items, ARRAY[]::types.i_update_auth_v4_auth_item[]) AS auth_items
),
auth_exists_check AS (
    -- Check if auth exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM auth WHERE id = (SELECT auth_id FROM params)
    )::boolean as auth_exists
),
actor_profile AS (
    SELECT 
        x.profile_id as profile_id,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
auth_id_resolved AS (
    SELECT x.auth_id as auth_id
    FROM params x
),
delete_existing_keys AS (
    -- NOTE: auth_item_keys table was removed in migration 74
    -- Keys are now linked through settings (setting_auth_keys, setting_provider_keys)
    -- This CTE is kept for compatibility but does nothing
    SELECT 1 WHERE false
),
delete_existing_values AS (
    -- NOTE: auth_item_values table was removed in migration 74
    -- Values are now managed through settings (setting_auth_values)
    -- This CTE is kept for compatibility but does nothing
    SELECT 1 WHERE false
),
delete_existing_items AS (
    -- Delete all existing auth items (cascade will handle keys/values)
    DELETE FROM auth_items
    WHERE auth_id = (SELECT auth_id FROM auth_id_resolved)
    RETURNING id
),
-- Insert/update name in names table
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    FROM params
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert/update description in descriptions table
description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
update_auth AS (
    -- Update auth entry (without name/description/active columns)
    UPDATE auth
    SET 
        auth_type = (SELECT auth_type FROM params),
        slug = (SELECT slug FROM params),
        updated_at = NOW()
    WHERE id = (SELECT auth_id FROM auth_id_resolved)
    RETURNING id as auth_id
),
-- Remove old name links
remove_old_name AS (
    DELETE FROM auth_names
    WHERE auth_id = (SELECT auth_id FROM auth_id_resolved)
      AND name_id NOT IN (SELECT name_id FROM name_resource)
),
-- Link auth to new name
link_auth_name AS (
    INSERT INTO auth_names (auth_id, name_id, created_at, updated_at)
    SELECT 
        ua.auth_id,
        nr.name_id,
        NOW(),
        NOW()
    FROM update_auth ua
    CROSS JOIN name_resource nr
    ON CONFLICT (auth_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Remove old description links
remove_old_description AS (
    DELETE FROM auth_descriptions
    WHERE auth_id = (SELECT auth_id FROM auth_id_resolved)
      AND description_id NOT IN (SELECT description_id FROM description_resource)
),
-- Link auth to new description
link_auth_description AS (
    INSERT INTO auth_descriptions (auth_id, description_id, created_at, updated_at)
    SELECT 
        ua.auth_id,
        dr.description_id,
        NOW(),
        NOW()
    FROM update_auth ua
    CROSS JOIN description_resource dr
    ON CONFLICT (auth_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Update auth active flag
update_auth_active_flag AS (
    UPDATE auth_flags SET
        value = (SELECT active FROM params),
        updated_at = NOW()
    WHERE auth_id = (SELECT auth_id FROM auth_id_resolved)
      AND type = 'active'::type_auth_flags
),
insert_auth_active_flag AS (
    INSERT INTO auth_flags (auth_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        ua.auth_id,
        f.id,
        'active'::type_auth_flags,
        (SELECT active FROM params),
        NOW(),
        NOW()
    FROM update_auth ua
    CROSS JOIN flags f
    WHERE f.name = 'active'
      AND NOT EXISTS (SELECT 1 FROM auth_flags af WHERE af.auth_id = ua.auth_id AND af.type = 'active'::type_auth_flags)
    ON CONFLICT (auth_id, flag_id, type) DO UPDATE SET 
        value = (SELECT active FROM params),
        updated_at = NOW()
),
items_expanded AS (
    -- Expand composite type array
    SELECT 
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
    -- Create all auth items (without value column - dropped in migration)
    INSERT INTO auth_items (
        auth_id,
        name,
        description,
        encrypted,
        position,
        active
    )
    SELECT 
        ua.auth_id,
        ie.item_name,
        ie.item_description,
        ie.item_encrypted,
        ie.item_position,
        ie.item_active
    FROM update_auth ua
    CROSS JOIN items_expanded ie
    RETURNING id as item_id, encrypted
),
link_encrypted_keys AS (
    -- NOTE: auth_item_keys table was removed in migration 74
    -- Keys are now linked through settings (setting_auth_keys, setting_provider_keys)
    -- This CTE is kept for compatibility but does nothing
    SELECT 1 WHERE false
)
SELECT 
    aec.auth_exists::boolean as auth_exists,
    aec.auth_exists::boolean as success,
    (SELECT n.name FROM names n JOIN name_resource nr ON n.id = nr.name_id LIMIT 1)::text as name,
    ((SELECT n.name FROM names n JOIN name_resource nr ON n.id = nr.name_id LIMIT 1) || ' updated successfully')::text as message,
    ap.actor_name::text as actor_name
FROM auth_exists_check aec
CROSS JOIN actor_profile ap
$$;