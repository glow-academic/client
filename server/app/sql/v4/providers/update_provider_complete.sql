-- Update provider with optional endpoint in a single transaction
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
        WHERE proname = 'api_update_provider_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_provider_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION api_update_provider_v4(
    provider_id uuid,
    name text,
    description text,
    value text,
    active boolean,
    base_url text,
    profile_id uuid
)
RETURNS TABLE (
    provider_exists boolean,
    provider_id uuid,
    actor_name text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT
        provider_id AS provider_id,
        name AS name,
        description AS description,
        value AS value,
        active AS active,
        NULLIF(TRIM(base_url), '') AS base_url,
        profile_id AS profile_id
),
provider_exists_check AS (
    -- Check if provider exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM providers WHERE id = (SELECT provider_id FROM params)
    )::boolean as provider_exists
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
update_provider AS (
    UPDATE providers
    SET 
        value = x.value,
        updated_at = NOW()
    FROM params x
    WHERE id = x.provider_id
    RETURNING id as provider_id
),
update_name AS (
    -- Update provider name (delete old, insert new)
    DELETE FROM provider_names
    WHERE provider_id = (SELECT provider_id FROM params)
    RETURNING provider_id
),
link_name AS (
    -- Link new name to provider
    INSERT INTO provider_names (provider_id, name_id, created_at, updated_at)
    SELECT up.provider_id, gocn.name_id, NOW(), NOW()
    FROM update_provider up
    CROSS JOIN get_or_create_name gocn
),
update_description AS (
    -- Update provider description (delete old, insert new if provided)
    DELETE FROM provider_descriptions
    WHERE provider_id = (SELECT provider_id FROM params)
    RETURNING provider_id
),
link_description AS (
    -- Link new description to provider (if provided)
    INSERT INTO provider_descriptions (provider_id, description_id, created_at, updated_at)
    SELECT up.provider_id, gocd.description_id, NOW(), NOW()
    FROM update_provider up
    CROSS JOIN get_or_create_description gocd
    WHERE gocd.description_id IS NOT NULL
),
update_flag AS (
    -- Update active flag
    INSERT INTO provider_flags (provider_id, flag_id, type, value, created_at, updated_at)
    SELECT up.provider_id, gaf.flag_id, 'active'::type_provider_flags, x.active, NOW(), NOW()
    FROM update_provider up
    CROSS JOIN get_active_flag gaf
    CROSS JOIN params x
    ON CONFLICT (provider_id, flag_id, type) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
),
update_endpoint AS (
    -- Update or create endpoint if base_url provided
    INSERT INTO provider_endpoints (provider_id, base_url, active, created_at, updated_at)
    SELECT 
        x.provider_id,
        x.base_url,
        true,
        NOW(),
        NOW()
    FROM params x
    WHERE x.base_url IS NOT NULL
    ON CONFLICT (provider_id) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        active = true,
        updated_at = NOW()
),
delete_endpoint AS (
    -- Delete endpoint if base_url is empty/null
    UPDATE provider_endpoints
    SET active = false, updated_at = NOW()
    FROM params x
    WHERE provider_endpoints.provider_id = x.provider_id
    AND x.base_url IS NULL
)
SELECT 
    pec.provider_exists::boolean as provider_exists,
    up.provider_id,
    ap.actor_name::text as actor_name
FROM provider_exists_check pec
LEFT JOIN update_provider up ON pec.provider_exists = true
CROSS JOIN actor_profile ap
$$;