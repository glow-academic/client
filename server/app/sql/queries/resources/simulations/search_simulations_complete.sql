-- Search simulations with suggest_source pattern
-- Returns simulation details with search and filtering
-- CLEAN PATTERN: Query simulations_resource directly (no time_limit computation)
-- Uses draft_id for suggest_source='draft' (efficient drafts_connection lookup)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_simulations_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_simulations_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_search_simulations_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    cohort boolean DEFAULT false,
    simulation boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_simulations_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description, q.department_ids, q.scenario_ids, q.scenario_rubric_ids, q.scenario_time_limit_ids, q.scenario_position_ids, q.scenario_flag_ids, q.active, q.generated, q.practice)::types.q_get_simulations_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_simulations_v4_item[]
) as items
FROM (
    SELECT
        s.id,
        s.name,
        COALESCE(s.description, '') as description,
        COALESCE(s.department_ids::text[], ARRAY[]::text[]) as department_ids,
        COALESCE(s.scenario_ids::text[], ARRAY[]::text[]) as scenario_ids,
        COALESCE(s.scenario_rubric_ids::text[], ARRAY[]::text[]) as scenario_rubric_ids,
        COALESCE(s.scenario_time_limit_ids::text[], ARRAY[]::text[]) as scenario_time_limit_ids,
        COALESCE(s.scenario_position_ids::text[], ARRAY[]::text[]) as scenario_position_ids,
        COALESCE(s.scenario_flag_ids::text[], ARRAY[]::text[]) as scenario_flag_ids,
        s.active,
        COALESCE(s.generated, false) as generated,
        COALESCE(s.practice, false) as practice
    FROM simulations_resource s
    WHERE s.active = true
      AND s.name IS NOT NULL
      AND s.name != ''
      -- Search filter
      AND (
          search IS NULL
          OR search = ''
          OR LOWER(s.name) LIKE '%' || LOWER(search) || '%'
          OR LOWER(COALESCE(s.description, '')) LIKE '%' || LOWER(search) || '%'
      )
      -- Exclude specified IDs
      AND (exclude_ids IS NULL OR NOT (s.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(department_ids, 1), 0) = 0 OR s.department_ids && department_ids)
      AND (COALESCE(array_length(scenario_ids, 1), 0) = 0 OR s.scenario_ids && scenario_ids)
      -- Suggest source filter
      AND (
          suggest_source = 'all'
          OR suggest_source IS NULL
          OR (
              suggest_source = 'draft'
              AND draft_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM (
                      SELECT simulations_id, draft_id FROM cohort_drafts_simulations_connection WHERE active = true
                  ) dc
                  WHERE dc.simulations_id = s.id
                    AND dc.draft_id = api_search_simulations_v4.draft_id
              )
          )
      )
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT cohort OR EXISTS (SELECT 1 FROM cohort_simulations_junction j WHERE j.simulations_id = s.id AND j.active = true))
      AND (NOT simulation OR EXISTS (SELECT 1 FROM simulation_simulations_junction j WHERE j.simulations_id = s.id AND j.active = true))
    ORDER BY s.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
