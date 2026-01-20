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
        SELECT 1 FROM auth_artifact WHERE id = (SELECT auth_id FROM params)
    )::boolean as auth_exists
),
actor_profile AS (
    SELECT 
        x.profile_id as profile_id,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
source_auth AS (
    SELECT 
        id, 
        (SELECT n.name FROM auth_names an JOIN names_resource n ON an.name_id = n.id WHERE an.auth_id = auth_artifact.id LIMIT 1) as name, 
        (SELECT d.description FROM auth_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.auth_id = auth_artifact.id LIMIT 1) as description, 
        EXISTS (SELECT 1 FROM auth_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.auth_id = auth_artifact.id AND f.name = 'active' AND af.value = TRUE) as active, 
        (SELECT p.value FROM auth_protocols ap JOIN protocols_resource p ON p.id = ap.protocol_id WHERE ap.auth_id = auth_artifact.id LIMIT 1) as auth_type, 
        (SELECT s.value FROM auth_slugs as_j JOIN slugs_resource s ON s.id = as_j.slug_id WHERE as_j.auth_id = auth_artifact.id LIMIT 1) as slug
    FROM params x
    JOIN auth_artifact ON auth_artifact.id = x.auth_id
),
-- Insert name INTO names_resource table and get ID
name_resource AS (
    INSERT INTO names_resource (name, created_at, updated_at)
    SELECT name || ' (Copy)', NOW(), NOW()
    FROM source_auth
    WHERE name IS NOT NULL AND name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description INTO descriptions_resource table and get ID
description_resource AS (
    INSERT INTO descriptions_resource (description, created_at, updated_at)
    SELECT description, NOW(), NOW()
    FROM source_auth
    WHERE description IS NOT NULL AND description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
-- Insert or get protocol for new auth
protocol_resource AS (
    INSERT INTO protocols_resource (value, created_at, updated_at)
    SELECT auth_type, NOW(), NOW()
    FROM source_auth
    WHERE auth_type IS NOT NULL AND auth_type != ''
    ON CONFLICT (value) DO UPDATE SET updated_at = NOW()
    RETURNING id as protocol_id
),
-- Insert or get slug for new auth
slug_resource AS (
    INSERT INTO slugs_resource (value, created_at, updated_at)
    SELECT slug || '-copy', NOW(), NOW()
    FROM source_auth
    WHERE slug IS NOT NULL AND slug != ''
    ON CONFLICT (value) DO UPDATE SET updated_at = NOW()
    RETURNING id as slug_id
),
new_auth AS (
    -- Create auth (no columns needed - all data in junction tables)
    INSERT INTO auths_resource (id)
    SELECT uuidv7()
    FROM source_auth
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
        (SELECT active FROM source_auth LIMIT 1),
        NOW(),
        NOW()
    FROM new_auth na
    CROSS JOIN flags_resource f
    WHERE f.name = 'active'
    ON CONFLICT (auth_id, flag_id) DO UPDATE SET 
        value = (SELECT active FROM source_auth LIMIT 1),
        updated_at = NOW()
),
source_items AS (
    SELECT 
        ROW_NUMBER() OVER (ORDER BY i.position, i.id) as item_idx,
        i.name,
        i.description,
        i.encrypted,
        i.position,
        i.active
    FROM source_auth sa
    JOIN auth_items ai_j ON ai_j.auth_id = sa.id
    JOIN items_resource i ON i.id = ai_j.item_id
),
new_items AS (
    -- Create new items (standalone table)
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
        si.name,
        si.description,
        si.encrypted,
        si.position,
        si.active,
        NOW(),
        NOW()
    FROM source_items si
    ORDER BY si.item_idx
    RETURNING id as item_id
),
items_with_idx AS (
    -- Match created items back to their source data using row numbers
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
    CROSS JOIN source_items si
    JOIN items_with_idx iwi ON iwi.item_idx = si.item_idx
    ON CONFLICT (auth_id, item_id) DO UPDATE SET updated_at = NOW()
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