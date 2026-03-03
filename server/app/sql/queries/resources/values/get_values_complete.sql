-- Get values resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[])
-- Returns: items (array of value resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_values_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_values_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_values_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for value item
CREATE TYPE types.q_get_values_v4_item AS (
    id uuid,
    value text,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_values_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_values_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (v.id, v.value, COALESCE(v.generated, false))::types.q_get_values_v4_item
        ORDER BY array_position(ids, v.id)
    ),
    ARRAY[]::types.q_get_values_v4_item[]
) as items
FROM values_resource v
WHERE v.id = ANY(ids)
  AND v.active = true;
$$;
