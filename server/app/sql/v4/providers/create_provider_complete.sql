-- Create provider with optional endpoint in a single transaction
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
        WHERE proname = 'api_create_provider_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_provider_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_create_provider_v4(
    name text,
    description text,
    value text,
    active boolean,
    base_url text,
    profile_id uuid
)
RETURNS TABLE (
    provider_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        name AS name,
        description AS description,
        value AS value,
        active AS active,
        NULLIF(TRIM(base_url), '') AS base_url,
        profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
get_or_create_name AS (
    -- Get or create name in names table
    INSERT INTO names (name, created_at, updated_at)
    SELECT x.name, NOW(), NOW()
    FROM params x
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
get_or_create_description AS (
    -- Get or create description in descriptions table
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT x.description, NOW(), NOW()
    FROM params x
    WHERE x.description IS NOT NULL AND x.description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
get_active_flag AS (
    -- Get the active flag ID
    SELECT id as flag_id
    FROM flags
    WHERE name = 'active'
    LIMIT 1
),
new_provider AS (
    INSERT INTO providers (value)
    SELECT x.value
    FROM params x
    RETURNING id as provider_id
),
link_name AS (
    -- Link name to provider
    INSERT INTO provider_names (provider_id, name_id, created_at, updated_at)
    SELECT np.provider_id, gocn.name_id, NOW(), NOW()
    FROM new_provider np
    CROSS JOIN get_or_create_name gocn
),
link_description AS (
    -- Link description to provider (if provided)
    INSERT INTO provider_descriptions (provider_id, description_id, created_at, updated_at)
    SELECT np.provider_id, gocd.description_id, NOW(), NOW()
    FROM new_provider np
    CROSS JOIN get_or_create_description gocd
    WHERE gocd.description_id IS NOT NULL
),
link_flag AS (
    -- Link active flag to provider
    INSERT INTO provider_flags (provider_id, flag_id, type, value, created_at, updated_at)
    SELECT np.provider_id, gaf.flag_id, 'active'::type_provider_flags, x.active, NOW(), NOW()
    FROM new_provider np
    CROSS JOIN get_active_flag gaf
    CROSS JOIN params x
    ON CONFLICT (provider_id, flag_id, type) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
),
link_endpoint AS (
    -- Link endpoint if base_url provided
    INSERT INTO provider_endpoints (provider_id, base_url, active, created_at, updated_at)
    SELECT 
        np.provider_id,
        x.base_url,
        true,
        NOW(),
        NOW()
    FROM new_provider np
    CROSS JOIN params x
    WHERE x.base_url IS NOT NULL
    ON CONFLICT (provider_id) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        active = true,
        updated_at = NOW()
)
SELECT 
    np.provider_id,
    ap.actor_name::text as actor_name
FROM new_provider np
CROSS JOIN actor_profile ap
$$;