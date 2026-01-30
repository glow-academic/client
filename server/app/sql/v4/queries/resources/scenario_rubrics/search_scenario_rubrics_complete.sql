-- Search available scenario rubrics for scenarios
-- Returns available rubrics that can be assigned to scenarios
-- Parameters: simulation_id (uuid), scenario_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_scenario_rubrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_scenario_rubrics_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Reuses type from get endpoint: types.q_get_scenario_rubrics_v4_item

CREATE OR REPLACE FUNCTION api_search_scenario_rubrics_v4(
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
-- Get all available rubrics for the given scenarios
available_rubrics AS (
    SELECT
        srr.id,
        srr.scenario_id,
        srr.rubric_id,
        COALESCE(srr.generated, false) as generated
    FROM params p
    CROSS JOIN LATERAL unnest(p.scen_ids) AS sid
    JOIN scenario_rubrics_resource srr ON srr.scenario_id = sid AND srr.active = true
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (ar.id, ar.scenario_id, ar.rubric_id, ar.generated)::types.q_get_scenario_rubrics_v4_item
            ORDER BY ar.scenario_id
        ) FROM available_rubrics ar),
        '{}'::types.q_get_scenario_rubrics_v4_item[]
    ) as items;
$$;
