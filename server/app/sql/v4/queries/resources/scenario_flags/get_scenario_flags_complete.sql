-- Get scenario flags for a simulation
-- Returns scenario flag details joined with flag information
-- Parameters: simulation_id (uuid), scenario_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_scenario_flags_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_flags_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_scenario_flags_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for scenario flag items
CREATE TYPE types.q_get_scenario_flags_v4_item AS (
    id uuid,
    scenario_id uuid,
    flag_id uuid,
    name text,
    description text,
    icon text,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_scenario_flags_v4(
    simulation_id uuid,
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_scenario_flags_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT simulation_id AS sim_id, scenario_ids AS scen_ids
),
flag_data AS (
    SELECT
        sfr.id,
        sfr.scenario_id,
        sfr.flag_id,
        f.name,
        COALESCE(f.description, '') as description,
        f.icon,
        COALESCE(ssfj.generated, false) as generated
    FROM params p
    JOIN simulation_scenario_flags_junction ssfj ON ssfj.simulation_id = p.sim_id
    JOIN scenario_flags_resource sfr ON sfr.id = ssfj.scenario_flag_id
    JOIN flags_resource f ON f.id = sfr.flag_id
    WHERE ssfj.value = true
      AND ssfj.active = true
      AND (COALESCE(array_length(p.scen_ids, 1), 0) = 0 OR sfr.scenario_id = ANY(p.scen_ids))
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (fd.id, fd.scenario_id, fd.flag_id, fd.name, fd.description, fd.icon, fd.generated)::types.q_get_scenario_flags_v4_item
            ORDER BY fd.name, fd.scenario_id
        ) FROM flag_data fd),
        '{}'::types.q_get_scenario_flags_v4_item[]
    ) as items;
$$;
