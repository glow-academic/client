-- Get simulation availability by resource IDs
-- Returns simulation availability details for the given IDs

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_simulation_availability_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_availability_v4(%s)', r.sig);
    END LOOP;
END $$;

DROP TYPE IF EXISTS types.q_get_simulation_availability_v4_item CASCADE;

CREATE TYPE types.q_get_simulation_availability_v4_item AS (
    id uuid,
    simulation_id uuid,
    time timestamptz,
    type text,
    generated boolean,
    mcp boolean
);

CREATE OR REPLACE FUNCTION api_get_simulation_availability_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_simulation_availability_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT
    COALESCE(
        ARRAY_AGG(
            (sar.id, sar.simulation_id, sar.time, sar.type::text, COALESCE(sar.generated, false), COALESCE(sar.mcp, false))::types.q_get_simulation_availability_v4_item
            ORDER BY sar.simulation_id, sar.type
        ),
        '{}'::types.q_get_simulation_availability_v4_item[]
    ) as items
FROM simulation_availability_resource sar
WHERE sar.id = ANY(ids)
  AND sar.active = true;
$$;
