-- Get pricing resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[])
-- Returns: items (array of pricing resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_pricing_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_pricing_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_pricing_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for pricing item
CREATE TYPE types.q_get_pricing_v4_item AS (
    id uuid,
    pricing_type text,
    price real,
    unit_id uuid,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_pricing_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_pricing_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (p.id, p.pricing_type::text, p.price, p.unit_id, COALESCE(p.generated, false))::types.q_get_pricing_v4_item
        ORDER BY array_position(ids, p.id)
    ),
    ARRAY[]::types.q_get_pricing_v4_item[]
) as items
FROM pricing_resource p
WHERE p.id = ANY(ids)
  AND p.active = true;
$$;
