-- Get simulations by IDs (batch)
-- Simple data fetching from simulations_resource table
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
        WHERE proname = 'api_get_simulations_batch_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulations_batch_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_simulations_batch_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for simulation batch item
CREATE TYPE types.q_get_simulations_batch_v4_item AS (
    simulation_id uuid,
    title text,
    description text,
    department_ids text[],
    time_limit bigint,
    active boolean,
    practice_simulation boolean
);

CREATE OR REPLACE FUNCTION api_get_simulations_batch_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_simulations_batch_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            s.id,
            s.name,
            COALESCE(s.description, ''),
            COALESCE(s.department_ids::text[], ARRAY[]::text[]),
            0::bigint,  -- time_limit not available in simulations_resource
            s.active,
            false  -- practice_simulation not available in simulations_resource
        )::types.q_get_simulations_batch_v4_item
        ORDER BY array_position(ids, s.id)
    ),
    ARRAY[]::types.q_get_simulations_batch_v4_item[]
) as items
FROM simulations_resource s
WHERE s.id = ANY(ids);
$$;
