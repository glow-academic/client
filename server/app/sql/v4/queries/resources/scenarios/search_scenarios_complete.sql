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
all_scenarios AS (
    SELECT
        s.id as scenario_id,
        (SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1) as title,
        COALESCE(
            (SELECT d.description FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1),
            ''
        ) as description,
        -- Check if scenario has active flag
        COALESCE(
            (SELECT sf.value FROM scenario_flags_junction sf
             JOIN flags_resource f ON sf.flag_id = f.id
             WHERE sf.scenario_id = s.id
               AND f.name = 'scenario_active'
             LIMIT 1),
            false
        ) as active,
        COALESCE(s.generated, false) as generated,
        -- Get department_id from scenario_departments_junction
        (SELECT sd.department_id FROM scenario_departments_junction sd WHERE sd.scenario_id = s.id LIMIT 1) as department_id,
        -- Get persona_id from scenario_personas_junction
        (SELECT sp.persona_id FROM scenario_personas_junction sp WHERE sp.scenario_id = s.id LIMIT 1) as persona_id,
        -- Get persona name
        (SELECT n.name FROM scenario_personas_junction sp
         JOIN persona_names_junction pn ON pn.persona_id = sp.persona_id
         JOIN names_resource n ON n.id = pn.name_id
         WHERE sp.scenario_id = s.id
         LIMIT 1) as persona_name,
        s.updated_at
    FROM scenario_artifact s
    CROSS JOIN params p
    -- Only include scenarios that are active
    WHERE EXISTS (
        SELECT 1 FROM scenario_flags_junction sf
        JOIN flags_resource f ON sf.flag_id = f.id
        WHERE sf.scenario_id = s.id
          AND f.name = 'scenario_active'
          AND sf.value = true
    )
    -- Apply search filter if provided
    AND (
        p.search_term IS NULL
        OR p.search_term = ''
        OR LOWER((SELECT n.name FROM scenario_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1)) LIKE '%' || LOWER(p.search_term) || '%'
        OR LOWER(COALESCE((SELECT d.description FROM scenario_descriptions_junction sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '')) LIKE '%' || LOWER(p.search_term) || '%'
    )
    -- Apply department filter if provided (user can only see scenarios in their departments or without departments)
    AND (
        p.user_dept_ids IS NULL
        OR NOT EXISTS (SELECT 1 FROM scenario_departments_junction sd WHERE sd.scenario_id = s.id)
        OR EXISTS (
            SELECT 1 FROM scenario_departments_junction sd
            WHERE sd.scenario_id = s.id
              AND sd.department_id = ANY(p.user_dept_ids)
        )
    )
    -- Exclude specified IDs
    AND NOT s.id = ANY(p.exclude_ids)
),
-- Scenarios linked to simulations (for 'linked' suggest_source)
linked_scenarios AS (
    SELECT DISTINCT
        a.scenario_id,
        a.title,
        a.description,
        a.active,
        a.generated,
        a.department_id,
        a.persona_id,
        a.persona_name,
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
        a.title,
        a.description,
        a.active,
        a.generated,
        a.department_id,
        a.persona_id,
        a.persona_name,
        a.updated_at
    FROM all_scenarios a
    ORDER BY a.updated_at DESC
),
-- Select based on suggest_source
filtered_scenarios AS (
    SELECT
        scenario_id,
        title,
        description,
        active,
        generated,
        department_id,
        persona_id,
        persona_name,
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
        fs.title,
        fs.description,
        fs.active,
        fs.generated,
        fs.department_id,
        fs.persona_id,
        fs.persona_name
    FROM filtered_scenarios fs
    ORDER BY fs.title ASC
)
SELECT COALESCE(
    ARRAY_AGG(
        (q.scenario_id, q.title, q.description, q.active, q.generated, q.department_id, q.persona_id, q.persona_name)::types.q_get_scenarios_v4_item
        ORDER BY q.title
    ),
    ARRAY[]::types.q_get_scenarios_v4_item[]
) as items
FROM (
    SELECT * FROM final_result
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
