-- Get profiles resources by IDs (batch)
-- Simple data fetching from profiles_resource only (denormalized emails)
-- Parameters: p_ids (uuid[])
-- Returns: items (array of profile resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_profiles_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profiles_v4(%s)', r.sig);
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
        WHERE proname = 'api_search_profiles_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_profiles_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_profiles_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for profile item
CREATE TYPE types.q_get_profiles_v4_item AS (
    profile_id uuid,
    name text,
    description text,
    emails text[],
    primary_email text,
    requests_per_day integer
);

-- Create function - query profiles_resource directly (emails denormalized)
CREATE OR REPLACE FUNCTION api_get_profiles_v4(
    p_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_profiles_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            p.id,
            p.name,
            COALESCE(p.description, ''),
            COALESCE(p.emails, ARRAY[]::text[]),
            p.primary_email,
            p.requests_per_day
        )::types.q_get_profiles_v4_item
        ORDER BY array_position(p_ids, p.id)
    ),
    ARRAY[]::types.q_get_profiles_v4_item[]
) as items
FROM profiles_resource p
WHERE p.id = ANY(p_ids)
  AND p.active = true;
$$;
