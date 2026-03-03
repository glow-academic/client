-- Get objective resource by ID
-- Simple data fetching for scenario two-pass architecture
-- Parameters: id (uuid)
-- Returns: item (single objective resource)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_objective_resource_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_objective_resource_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_objective_resource_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for objective item
CREATE TYPE types.q_get_objective_resource_v4_item AS (
    objective_id uuid,
    objective text,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_objective_resource_v4(
    id uuid
)
RETURNS TABLE (
    items types.q_get_objective_resource_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            o.id,
            o.objective,
            COALESCE(o.generated, false)
        )::types.q_get_objective_resource_v4_item
    ),
    ARRAY[]::types.q_get_objective_resource_v4_item[]
) as items
FROM objectives_resource o
WHERE o.id = id
  AND o.active = true;
$$;
