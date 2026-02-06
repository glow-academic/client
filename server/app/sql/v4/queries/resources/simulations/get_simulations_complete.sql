-- Get simulation by ID
-- Returns simulation details for a single ID
-- CLEAN PATTERN: Query simulations_resource directly with denormalized name/description

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
    time_limit bigint,
    generated boolean
);

-- Accepts simulation resource ID and returns simulation details
-- Returns item as array for asyncpg compatibility
CREATE OR REPLACE FUNCTION api_get_simulations_v4(
    p_simulation_id uuid
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
            -- Time limit computed from scenario_time_limits via artifact connection
            COALESCE(
                (SELECT SUM(stlr.time_limit_seconds)
                 FROM simulation_simulations_junction ssj
                 JOIN simulation_scenario_time_limits_junction sstl ON sstl.simulation_id = ssj.simulation_id
                 JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
                 JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
                 WHERE ssj.simulations_id = s.id
                   AND sstl.active = true
                   AND stlr.active = true
                   AND EXISTS (
                       SELECT 1 FROM simulation_scenario_flags_junction ssf
                       JOIN scenario_flags_resource sfr ON ssf.scenario_flag_id = sfr.id
                       JOIN flags_resource f ON sfr.flag_id = f.id
                       WHERE ssf.simulation_id = ss.simulation_id
                         AND sfr.scenario_id = ss.scenario_id
                         AND f.name = 'scenario_active'
                         AND ssf.value = true
                   )
                ),
                0
            )::bigint,
            COALESCE(s.generated, false)
        )::types.q_get_simulations_v4_item
    ),
    ARRAY[]::types.q_get_simulations_v4_item[]
) as items
FROM simulations_resource s
WHERE s.id = p_simulation_id
  AND s.active = true;
$$;
