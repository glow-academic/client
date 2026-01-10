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
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
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
-- Insert name into names table and get ID
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT name, NOW(), NOW()
    FROM params
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description into descriptions table and get ID
description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM params
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
new_key AS (
    -- Create key (without name/description/active columns)
    INSERT INTO key (key, created_at, updated_at)
    SELECT key, NOW(), NOW()
    FROM params
    RETURNING id as key_id, key
),
-- Link key to name
link_key_name AS (
    INSERT INTO key_names (key_id, name_id, created_at, updated_at)
    SELECT 
        nk.key_id,
        nr.name_id,
        NOW(),
        NOW()
    FROM new_key nk
    CROSS JOIN name_resource nr
    ON CONFLICT (key_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link key to description
link_key_description AS (
    INSERT INTO key_descriptions (key_id, description_id, created_at, updated_at)
    SELECT 
        nk.key_id,
        dr.description_id,
        NOW(),
        NOW()
    FROM new_key nk
    CROSS JOIN description_resource dr
    ON CONFLICT (key_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link key active flag
link_key_active_flag AS (
    INSERT INTO key_flags (key_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        nk.key_id,
        f.id,
        'active'::type_key_flags,
        x.active,
        NOW(),
        NOW()
    FROM new_key nk
    CROSS JOIN params x
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (key_id, flag_id, type) DO UPDATE SET 
        value = EXCLUDED.value,
        updated_at = NOW()
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