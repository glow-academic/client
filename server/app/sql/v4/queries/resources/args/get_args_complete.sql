-- Get args resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[])
-- Returns: items (array of arg resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_args_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_args_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_args_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for arg item
CREATE TYPE types.q_get_args_v4_item AS (
    id uuid,
    name text,
    description text,
    field_type text,
    required boolean,
    default_value text,
    position integer,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_args_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_args_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (a.id, a.name, a.description, a.field_type, a.required, a.default_value, a.position, COALESCE(a.generated, false))::types.q_get_args_v4_item
        ORDER BY array_position(ids, a.id)
    ),
    ARRAY[]::types.q_get_args_v4_item[]
) as items
FROM args_resource a
WHERE a.id = ANY(ids)
  AND a.active = true;
$$;
