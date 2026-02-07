-- Get regenerates resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[])
-- Returns: items (array of regenerate resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_regenerates_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_regenerates_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITH CASCADE (search function depends on these types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_regenerates_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for regenerate item
CREATE TYPE types.q_get_regenerates_v4_item AS (
    id uuid,
    instructions text,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_regenerates_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_regenerates_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (r.id, r.instructions, COALESCE(r.generated, false))::types.q_get_regenerates_v4_item
        ORDER BY array_position(ids, r.id)
    ),
    ARRAY[]::types.q_get_regenerates_v4_item[]
) as items
FROM regenerates_resource r
WHERE r.id = ANY(ids)
  AND r.active = true;
$$;
