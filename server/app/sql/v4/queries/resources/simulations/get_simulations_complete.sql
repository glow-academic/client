-- Get simulations by IDs
-- Standard batch resource endpoint
-- Parameters: ids (uuid[])
-- Returns: items (array of simulation resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_simulations_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulations_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop type if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_simulations_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for simulation item
CREATE TYPE types.q_get_simulations_v4_item AS (
    simulation_id uuid,
    name text,
    description text,
    department_ids text[],
    active boolean,
    generated boolean
);

-- Accepts simulation resource IDs and returns simulation details
CREATE OR REPLACE FUNCTION api_get_simulations_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_simulations_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        ROW(
            s.id,
            s.name,
            COALESCE(s.description, ''),
            COALESCE(s.department_ids::text[], ARRAY[]::text[]),
            s.active,
            COALESCE(s.generated, false)
        )::types.q_get_simulations_v4_item
        ORDER BY array_position(ids, s.id)
    ),
    ARRAY[]::types.q_get_simulations_v4_item[]
) as items
FROM simulations_resource s
WHERE s.id = ANY(ids);
$$;
