-- Get scenario rubrics for a simulation
-- Returns scenario rubric associations for scenarios in a simulation
-- Parameters: simulation_id (uuid), scenario_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_scenario_rubrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_rubrics_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_scenario_rubrics_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for scenario rubric items
CREATE TYPE types.q_get_scenario_rubrics_v4_item AS (
    id uuid,
    scenario_id uuid,
    rubric_id uuid,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_scenario_rubrics_v4(
    simulation_id uuid,
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_scenario_rubrics_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT simulation_id AS sim_id, scenario_ids AS scen_ids
),
rubric_data AS (
    SELECT
        srr.id,
        srr.scenario_id,
        srr.rubric_id,
        COALESCE(ssrj.generated, false) as generated
    FROM params p
    JOIN simulation_scenario_rubrics_junction ssrj ON ssrj.simulation_id = p.sim_id
    JOIN scenario_rubrics_resource srr ON srr.id = ssrj.scenario_rubric_id
    WHERE ssrj.active = true
      AND (COALESCE(array_length(p.scen_ids, 1), 0) = 0 OR srr.scenario_id = ANY(p.scen_ids))
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (rd.id, rd.scenario_id, rd.rubric_id, rd.generated)::types.q_get_scenario_rubrics_v4_item
            ORDER BY rd.scenario_id
        ) FROM rubric_data rd),
        '{}'::types.q_get_scenario_rubrics_v4_item[]
    ) as items;
$$;
