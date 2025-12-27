-- Create auth with items (encrypted items use keys, values managed separately in settings)
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
        WHERE proname = 'api_create_auth_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_auth_v3(%s)', r.sig);
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
        WHERE typname LIKE 'i_create_auth_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.i_create_auth_v3_auth_item AS (
    name text,
    description text,
    encrypted boolean,
    position integer,
    active boolean,
    key_id uuid  -- NULL allowed by default in PostgreSQL
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_create_auth_v3(
    name text,
    description text,
    active boolean,
    auth_type text,
    slug text,
    profile_id uuid,
    auth_items types.i_create_auth_v3_auth_item[] DEFAULT ARRAY[]::types.i_create_auth_v3_auth_item[]
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
        COALESCE(auth_items, ARRAY[]::types.i_create_auth_v3_auth_item[]) AS auth_items
),
actor_profile AS (
    SELECT 
        x.profile_id as resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
new_auth AS (
    INSERT INTO auth (
        name,
        description,
        active,
        auth_type,
        slug
    )
    SELECT x.name, x.description, x.active, x.auth_type, x.slug
    FROM params x
    RETURNING id as auth_id
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
        na.auth_id,
        ie.item_name,
        ie.item_description,
        ie.item_encrypted,
        ie.item_position,
        ie.item_active
    FROM new_auth na
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
    true::boolean as success,
    na.auth_id,
    x.name,
    (x.name || ' created successfully')::text as message,
    ap.actor_name
FROM new_auth na
CROSS JOIN actor_profile ap
CROSS JOIN params x
$$;

COMMIT;
