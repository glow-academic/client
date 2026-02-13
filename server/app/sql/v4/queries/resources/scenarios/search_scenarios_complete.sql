-- Search scenarios with suggest_source pattern
-- Returns scenario details with search and filtering
-- CLEAN PATTERN: Query scenarios_resource only (filter on active = true)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_scenarios_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_scenarios_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_search_scenarios_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    department_ids uuid[] DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    persona_ids uuid[] DEFAULT ARRAY[]::uuid[],
    parameter_ids uuid[] DEFAULT ARRAY[]::uuid[],
    parent_ids uuid[] DEFAULT ARRAY[]::uuid[],
    is_root boolean DEFAULT NULL,
    problem_statement_enabled boolean DEFAULT NULL,
    objectives_enabled boolean DEFAULT NULL,
    video_enabled boolean DEFAULT NULL,
    images_enabled boolean DEFAULT NULL,
    questions_enabled boolean DEFAULT NULL,
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    scenario boolean DEFAULT false,
    simulation boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_scenarios_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.scenario_id, q.name, q.description, q.generated, q.problem_statement_enabled, q.objectives_enabled, q.video_enabled, q.images_enabled, q.questions_enabled, q.persona_ids)::types.q_get_scenarios_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_scenarios_v4_item[]
) as items
FROM (
    SELECT
        s.id as scenario_id,
        s.name,
        COALESCE(s.description, '') as description,
        COALESCE(s.generated, false) as generated,
        s.problem_statement_enabled,
        s.objectives_enabled,
        s.video_enabled,
        s.images_enabled,
        s.questions_enabled,
        COALESCE(s.persona_ids, ARRAY[]::uuid[]) as persona_ids
    FROM scenarios_resource s
    WHERE s.active = true
      -- Search filter
      AND (
          search IS NULL
          OR search = ''
          OR LOWER(s.name) LIKE '%' || LOWER(search) || '%'
          OR LOWER(COALESCE(s.description, '')) LIKE '%' || LOWER(search) || '%'
      )
      -- Department filter
      AND (
          department_ids IS NULL
          OR s.department_ids IS NULL
          OR array_length(s.department_ids, 1) IS NULL
          OR s.department_ids && department_ids
      )
      -- Exclude specified IDs
      AND (COALESCE(array_length(exclude_ids, 1), 0) = 0 OR NOT s.id = ANY(exclude_ids))
      AND (COALESCE(array_length(persona_ids, 1), 0) = 0 OR s.persona_ids && persona_ids)
      AND (COALESCE(array_length(parameter_ids, 1), 0) = 0 OR s.parameter_ids && parameter_ids)
      AND (COALESCE(array_length(parent_ids, 1), 0) = 0 OR s.parent_id = ANY(parent_ids))
      AND (is_root IS NULL OR s.is_root = is_root)
      AND (problem_statement_enabled IS NULL OR s.problem_statement_enabled = problem_statement_enabled)
      AND (objectives_enabled IS NULL OR s.objectives_enabled = objectives_enabled)
      AND (video_enabled IS NULL OR s.video_enabled = video_enabled)
      AND (images_enabled IS NULL OR s.images_enabled = images_enabled)
      AND (questions_enabled IS NULL OR s.questions_enabled = questions_enabled)
      -- Suggest source filter
      AND (
          suggest_source = 'all'
          OR suggest_source IS NULL
      )
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT scenario OR EXISTS (SELECT 1 FROM scenario_scenarios_junction j WHERE j.scenario_id = s.id AND j.active = true))
      AND (NOT simulation OR EXISTS (SELECT 1 FROM simulation_scenarios_junction j WHERE j.scenario_id = s.id AND j.active = true))
    ORDER BY s.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
