-- ============================================================================
-- Query Function: api_get_simulation_scenario_counts_v4
-- Active scenario counts per simulation.
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_simulation_scenario_counts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_scenario_counts_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_simulation_scenario_counts_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_simulation_scenario_counts_v4_item AS (
    simulation_id uuid,
    scenario_count int
);

CREATE OR REPLACE FUNCTION api_get_simulation_scenario_counts_v4(
    simulation_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
    items types.q_get_simulation_scenario_counts_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH counts AS (
    SELECT
        ssj.simulation_id,
        COUNT(DISTINCT ssj.scenario_id)::int AS scenario_count
    FROM simulation_scenarios_junction ssj
    WHERE
        ssj.active = TRUE
        AND (
            COALESCE(cardinality(simulation_ids), 0) = 0
            OR ssj.simulation_id = ANY(simulation_ids)
        )
    GROUP BY ssj.simulation_id
)
SELECT COALESCE(
    ARRAY_AGG(
        (
            c.simulation_id,
            c.scenario_count
        )::types.q_get_simulation_scenario_counts_v4_item
        ORDER BY c.simulation_id
    ),
    ARRAY[]::types.q_get_simulation_scenario_counts_v4_item[]
) AS items
FROM counts c;
$$;
