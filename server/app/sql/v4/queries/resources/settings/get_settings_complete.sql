-- Get settings resource by ID
-- Simple data fetching for profile context 2-pass architecture
-- Parameters: id (uuid)
-- Returns: full settings data including auths and providers

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_settings_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_settings_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop search function if exists (avoids type dependency conflicts)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_settings_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_settings_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types in reverse dependency order (item first, then nested types)
DROP TYPE IF EXISTS types.q_get_settings_v4_item;
DROP TYPE IF EXISTS types.q_get_settings_v4_auth;

-- Create nested composite types
CREATE TYPE types.q_get_settings_v4_auth AS (
    auth_id uuid,
    name text,
    description text,
    slug text
);

-- Create main composite type for settings item
CREATE TYPE types.q_get_settings_v4_item AS (
    settings_id text,
    created_at timestamptz,
    active boolean,
    name text,
    description text,
    primary_color text,
    accent text,
    background text,
    surface text,
    success text,
    warning text,
    error text,
    sidebar_background text,
    sidebar_primary text,
    chart1 text,
    chart2 text,
    chart3 text,
    chart4 text,
    chart5 text,
    guest_login_enabled boolean,
    success_threshold integer,
    warning_threshold integer,
    danger_threshold integer,
    auth_ids text[],
    auths types.q_get_settings_v4_auth[],
    provider_key_ids uuid[]
);

-- Create function — reads directly from settings_resource columns
-- Colors, thresholds, and guest_login_enabled are fetched via the artifact-level theme query
CREATE OR REPLACE FUNCTION api_get_settings_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_settings_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH resolved_resources AS (
    -- Fetch settings_resource rows directly by ID
    SELECT sr.*
    FROM settings_resource sr
    WHERE sr.id = ANY(ids)
      AND sr.active = true
),
settings_auths_data AS (
    -- Get auth details from auths_resource using auth_ids on settings_resource
    SELECT
        rr.id as resource_id,
        ARRAY_AGG(a.id::text ORDER BY COALESCE(a.name, '')) as auth_ids,
        COALESCE(
            ARRAY_AGG(
                (a.id, COALESCE(a.name, ''), COALESCE(a.description, ''), COALESCE(a.slug, ''))::types.q_get_settings_v4_auth
                ORDER BY COALESCE(a.name, '')
            ),
            ARRAY[]::types.q_get_settings_v4_auth[]
        ) as auths
    FROM resolved_resources rr
    CROSS JOIN LATERAL unnest(COALESCE(rr.auth_ids, ARRAY[]::uuid[])) AS auth_id_val
    JOIN auths_resource a ON a.id = auth_id_val AND a.active = true
    GROUP BY rr.id
)
SELECT COALESCE(
    ARRAY_AGG(
        (
            rr.id::text,
            rr.created_at,
            rr.active,
            COALESCE(rr.name, ''),
            COALESCE(rr.description, ''),
            NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
            NULL,
            NULL, NULL, NULL,
            COALESCE(sad.auth_ids, ARRAY[]::text[]),
            COALESCE(sad.auths, ARRAY[]::types.q_get_settings_v4_auth[]),
            COALESCE(rr.provider_key_ids, ARRAY[]::uuid[])
        )::types.q_get_settings_v4_item
    ),
    ARRAY[]::types.q_get_settings_v4_item[]
) as items
FROM resolved_resources rr
LEFT JOIN settings_auths_data sad ON sad.resource_id = rr.id;
$$;
