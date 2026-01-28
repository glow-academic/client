-- Get simulation by ID
-- Returns simulation details for a single ID

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
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
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

CREATE OR REPLACE FUNCTION api_get_simulations_v4(
    id uuid
)
RETURNS TABLE (
    item types.q_get_simulations_v4_item
)
LANGUAGE sql
STABLE
AS $$
WITH simulation_data AS (
    SELECT
        s.id as simulation_id,
        (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as name,
        COALESCE(
            (SELECT d.description FROM simulation_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1),
            ''
        ) as description,
        COALESCE(
            (SELECT SUM(stlr.time_limit_seconds)
             FROM simulation_scenario_time_limits_junction sstl
             JOIN scenario_time_limits_resource stlr ON stlr.id = sstl.scenario_time_limit_id
             JOIN simulation_scenarios_junction ss ON ss.simulation_id = sstl.simulation_id AND ss.scenario_id = stlr.scenario_id
             WHERE sstl.simulation_id = s.id
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
        ) as time_limit,
        COALESCE(s.generated, false) as generated
    FROM simulation_artifact s
    WHERE s.id = id
      AND EXISTS (
        SELECT 1 FROM simulation_flags_junction sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.simulation_id = s.id
          AND f.name = 'simulation_active'
          AND sf.value = true
    )
)
SELECT
    (sd.simulation_id, sd.name, sd.description, sd.time_limit, sd.generated)::types.q_get_simulations_v4_item as item
FROM simulation_data sd;
$$;
