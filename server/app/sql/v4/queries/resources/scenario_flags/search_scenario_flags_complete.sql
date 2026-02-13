-- Search available scenario flags for scenarios
-- Returns available flags from scenario_flags_resource
-- Parameters: scenario_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_scenario_flags_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_scenario_flags_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Reuses type from get endpoint: types.q_get_scenario_flags_v4_item

CREATE OR REPLACE FUNCTION api_search_scenario_flags_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    simulation boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_scenario_flags_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH filtered AS (
    SELECT sfr.id, sfr.scenario_id, sfr.flag_id, f.name, COALESCE(f.description, '') as description, COALESCE(f.icon, '') as icon, COALESCE(sfr.generated, false) as generated
    FROM scenario_flags_resource sfr
    JOIN flags_resource f ON f.id = sfr.flag_id AND f.active = true
    WHERE sfr.active = true
      AND (
        COALESCE(array_length(scenario_ids, 1), 0) = 0
        OR sfr.scenario_id = ANY(scenario_ids)
      )
      AND (search IS NULL OR f.name ILIKE '%' || search || '%' OR f.description ILIKE '%' || search || '%')
      AND (COALESCE(array_length(exclude_ids, 1), 0) = 0 OR sfr.id != ALL(exclude_ids))
      -- Artifact boolean filters
      AND (NOT simulation OR EXISTS (SELECT 1 FROM simulation_scenario_flags_junction j WHERE j.scenario_flag_id = sfr.id AND j.active = true))
    ORDER BY f.name, sfr.scenario_id
    LIMIT limit_count
    OFFSET offset_count
)
SELECT COALESCE(
    ARRAY_AGG(
        (f.id, f.scenario_id, f.flag_id, f.name, f.description, f.icon, f.generated)::types.q_get_scenario_flags_v4_item
        ORDER BY f.name, f.scenario_id
    ),
    '{}'::types.q_get_scenario_flags_v4_item[]
) as items
FROM filtered f;
$$;
