-- Get slugs resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[])
-- Returns: items (array of slug resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_slugs_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_slugs_v4(%s)', r.sig);
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
        WHERE proname = 'api_search_slugs_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_slugs_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_slugs_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for slug item
CREATE TYPE types.q_get_slugs_v4_item AS (
    id uuid,
    value text,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_slugs_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_slugs_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (s.id, s.value, COALESCE(s.generated, false))::types.q_get_slugs_v4_item
        ORDER BY array_position(ids, s.id)
    ),
    ARRAY[]::types.q_get_slugs_v4_item[]
) as items
FROM slugs_resource s
WHERE s.id = ANY(ids);
$$;
