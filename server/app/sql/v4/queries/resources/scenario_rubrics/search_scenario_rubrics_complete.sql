-- Search available scenario rubrics for scenarios
-- Returns available rubrics from scenario_rubrics_resource
-- Parameters: scenario_ids (uuid[])

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
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_scenario_rubrics_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT
    COALESCE(
        ARRAY_AGG(
            (srr.id, srr.scenario_id, srr.rubric_id, COALESCE(srr.generated, false))::types.q_get_scenario_rubrics_v4_item
            ORDER BY srr.scenario_id
        ),
        '{}'::types.q_get_scenario_rubrics_v4_item[]
    ) as items
FROM scenario_rubrics_resource srr
WHERE srr.active = true
  AND (
    COALESCE(array_length(scenario_ids, 1), 0) = 0
    OR srr.scenario_id = ANY(scenario_ids)
  );
$$;
