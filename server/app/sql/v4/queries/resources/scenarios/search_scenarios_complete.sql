-- Search scenarios with suggest_source pattern
-- Returns scenario details with search and filtering

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
    user_department_ids uuid[] DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_scenarios_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        search AS search_term,
        COALESCE(limit_count, 20) AS limit_val,
        COALESCE(offset_count, 0) AS offset_val,
        user_department_ids AS user_dept_ids,
        COALESCE(suggest_source, 'all') AS suggest_source,
        COALESCE(exclude_ids, ARRAY[]::uuid[]) AS exclude_ids
),
-- All active scenarios with search filtering
-- Joins through scenario_artifact to ensure deleted scenarios don't appear (like personas pattern)
all_scenarios AS (
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
        s.templates_enabled,
        COALESCE(s.persona_ids, ARRAY[]::uuid[]) as persona_ids,
        s.created_at as updated_at
    FROM scenarios_resource s
    -- Join to scenario_scenarios_junction to get the artifact link
    JOIN scenario_scenarios_junction ssj ON ssj.scenarios_id = s.id AND ssj.active = true
    -- Join to scenario_artifact to ensure it exists (not deleted)
    JOIN scenario_artifact sa ON sa.id = ssj.scenario_id
    CROSS JOIN params p
    -- Only include active scenarios
    WHERE s.active = true
    -- Apply search filter if provided
    AND (
        p.search_term IS NULL
        OR p.search_term = ''
        OR LOWER(s.name) LIKE '%' || LOWER(p.search_term) || '%'
        OR LOWER(COALESCE(s.description, '')) LIKE '%' || LOWER(p.search_term) || '%'
    )
    -- Apply department filter if provided (user can only see scenarios in their departments or without departments)
    AND (
        p.user_dept_ids IS NULL
        OR s.department_ids IS NULL
        OR array_length(s.department_ids, 1) IS NULL
        OR s.department_ids && p.user_dept_ids
    )
    -- Exclude specified IDs
    AND NOT s.id = ANY(p.exclude_ids)
),
-- Scenarios linked to simulations (for 'linked' suggest_source)
linked_scenarios AS (
    SELECT DISTINCT
        a.scenario_id,
        a.name,
        a.description,
        a.generated,
        a.problem_statement_enabled,
        a.objectives_enabled,
        a.video_enabled,
        a.images_enabled,
        a.questions_enabled,
        a.templates_enabled,
        a.persona_ids,
        a.updated_at
    FROM all_scenarios a
    WHERE EXISTS (
        SELECT 1 FROM simulation_scenarios_junction ss
        WHERE ss.scenario_id = a.scenario_id
          AND ss.active = true
    )
),
-- Recently updated scenarios (for 'recent' suggest_source)
recent_scenarios AS (
    SELECT DISTINCT
        a.scenario_id,
        a.name,
        a.description,
        a.generated,
        a.problem_statement_enabled,
        a.objectives_enabled,
        a.video_enabled,
        a.images_enabled,
        a.questions_enabled,
        a.templates_enabled,
        a.persona_ids,
        a.updated_at
    FROM all_scenarios a
    ORDER BY a.updated_at DESC
),
-- Select based on suggest_source
filtered_scenarios AS (
    SELECT
        scenario_id,
        name,
        description,
        generated,
        problem_statement_enabled,
        objectives_enabled,
        video_enabled,
        images_enabled,
        questions_enabled,
        templates_enabled,
        persona_ids,
        updated_at
    FROM (
        SELECT * FROM all_scenarios a
        CROSS JOIN params p
        WHERE p.suggest_source = 'all'
        UNION ALL
        SELECT * FROM linked_scenarios l
        CROSS JOIN params p
        WHERE p.suggest_source = 'linked'
        UNION ALL
        SELECT * FROM recent_scenarios r
        CROSS JOIN params p
        WHERE p.suggest_source = 'recent'
    ) sub
),
-- Final result with pagination
final_result AS (
    SELECT
        fs.scenario_id,
        fs.name,
        fs.description,
        fs.generated,
        fs.problem_statement_enabled,
        fs.objectives_enabled,
        fs.video_enabled,
        fs.images_enabled,
        fs.questions_enabled,
        fs.templates_enabled,
        fs.persona_ids
    FROM filtered_scenarios fs
    ORDER BY fs.name ASC
)
SELECT COALESCE(
    ARRAY_AGG(
        (q.scenario_id, q.name, q.description, q.generated, q.problem_statement_enabled, q.objectives_enabled, q.video_enabled, q.images_enabled, q.questions_enabled, q.templates_enabled, q.persona_ids)::types.q_get_scenarios_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_scenarios_v4_item[]
) as items
FROM (
    SELECT * FROM final_result
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
