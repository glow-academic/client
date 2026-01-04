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
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
update_provider AS (
    UPDATE providers
    SET 
        name = x.name,
        description = x.description,
        value = x.value,
        active = x.active,
        updated_at = NOW()
    FROM params x
    WHERE id = x.provider_id
    RETURNING id as provider_id
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