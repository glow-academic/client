-- Duplicate auth with items and values in a single transaction
-- Converted to function
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_duplicate_auth_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_duplicate_auth_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_duplicate_auth_v4(
    auth_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    auth_exists boolean,
    success boolean,
    auth_id uuid,
    original_name text,
    message text,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT auth_id AS auth_id,
           profile_id AS profile_id
),
auth_exists_check AS (
    -- Check if auth exists before duplication
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
source_auth AS (
    SELECT 
        id, 
        (SELECT n.name FROM auth_names an JOIN names n ON an.name_id = n.id WHERE an.auth_id = auth.id LIMIT 1) as name, 
        (SELECT d.description FROM auth_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.auth_id = auth.id LIMIT 1) as description, 
        EXISTS (SELECT 1 FROM auth_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.auth_id = auth.id AND fl.name = 'active' AND af.type = 'active'::type_auth_flags AND af.value = TRUE) as active, 
        auth_type, 
        slug
    FROM params x
    JOIN auth ON auth.id = x.auth_id
),
-- Insert name into names table and get ID
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT name || ' (Copy)', NOW(), NOW()
    FROM source_auth
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description into descriptions table and get ID
description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM source_auth
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
new_auth AS (
    -- Create auth (without name/description/active columns)
    INSERT INTO auth (
        auth_type,
        slug
    )
    SELECT 
        auth_type,
        slug || '-copy'
    FROM source_auth
    RETURNING id as auth_id
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
    INSERT INTO auth_flags (auth_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        na.auth_id,
        f.id,
        'active'::type_auth_flags,
        (SELECT active FROM source_auth LIMIT 1),
        NOW(),
        NOW()
    FROM new_auth na
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (auth_id, flag_id, type) DO UPDATE SET 
        value = (SELECT active FROM source_auth LIMIT 1),
        updated_at = NOW()
),
source_items AS (
    SELECT 
        ai.name,
        ai.description,
        ai.encrypted,
        ai.position,
        ai.active
    FROM source_auth sa
    JOIN auth_items ai ON ai.auth_id = sa.id
),
new_items AS (
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
        si.name,
        si.description,
        si.encrypted,
        si.position,
        si.active
    FROM new_auth na
    CROSS JOIN source_items si
    RETURNING id as item_id
)
SELECT 
    aec.auth_exists::boolean as auth_exists,
    aec.auth_exists::boolean as success,
    na.auth_id,
    sa.name::text as original_name,
    (sa.name || ' duplicated successfully')::text as message,
    ap.actor_name::text as actor_name
FROM auth_exists_check aec
CROSS JOIN actor_profile ap
LEFT JOIN source_auth sa ON true
LEFT JOIN new_auth na ON true
$$;