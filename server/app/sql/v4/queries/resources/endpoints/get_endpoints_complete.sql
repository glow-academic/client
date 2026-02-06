-- Get endpoints resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[])
-- Returns: items (array of endpoint resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_endpoints_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_endpoints_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_endpoints_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for endpoint item
CREATE TYPE types.q_get_endpoints_v4_item AS (
    id uuid,
    base_url text,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_endpoints_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_endpoints_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (e.id, e.base_url, COALESCE(e.generated, false))::types.q_get_endpoints_v4_item
        ORDER BY array_position(ids, e.id)
    ),
    ARRAY[]::types.q_get_endpoints_v4_item[]
) as items
FROM endpoints_resource e
WHERE e.id = ANY(ids)
  AND e.active = true;
$$;
