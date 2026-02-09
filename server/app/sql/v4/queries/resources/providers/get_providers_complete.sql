-- Get providers resources by IDs
-- Simple data fetching from denormalized providers_resource
-- Parameters: ids (uuid[])
-- Returns: items (array of provider resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_providers_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_providers_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_providers_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for provider item
CREATE TYPE types.q_get_providers_v4_item AS (
    id uuid,
    value text,
    name text,
    description text,
    endpoint text,
    key text,
    active boolean,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_providers_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_providers_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (p.id, p.value, p.name, p.description, p.endpoint, p.key, COALESCE(p.active, true), COALESCE(p.generated, false))::types.q_get_providers_v4_item
        ORDER BY array_position(ids, p.id)
    ),
    ARRAY[]::types.q_get_providers_v4_item[]
) as items
FROM providers_resource p
WHERE p.id = ANY(ids);
$$;
