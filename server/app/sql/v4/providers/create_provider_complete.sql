-- Create provider with optional endpoint in a single transaction
-- Converted to function
-- Uses safe drop/recreate pattern: drop function first, then recreate

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
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
new_provider AS (
    INSERT INTO providers (
        name,
        description,
        value,
        active
    )
    SELECT 
        x.name,
        x.description,
        x.value,
        x.active
    FROM params x
    RETURNING id as provider_id
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

COMMIT;
