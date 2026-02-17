-- Search departments resources with optional context
-- CLEAN PATTERN: Query departments_resource directly with denormalized name/description
-- Uses draft_id for suggest_source='draft' (efficient drafts_connection lookup)
-- Parameters: search (text), limit_count (int), offset_count (int), department_ids (uuid[]), draft_id (uuid), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of department resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_departments_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_departments_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_departments_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    setting_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    agent boolean DEFAULT false,
    auth boolean DEFAULT false,
    cohort boolean DEFAULT false,
    department boolean DEFAULT false,
    document boolean DEFAULT false,
    eval boolean DEFAULT false,
    field boolean DEFAULT false,
    model boolean DEFAULT false,
    parameter boolean DEFAULT false,
    persona boolean DEFAULT false,
    profile boolean DEFAULT false,
    provider boolean DEFAULT false,
    rubric boolean DEFAULT false,
    scenario boolean DEFAULT false,
    setting boolean DEFAULT false,
    simulation boolean DEFAULT false,
    tool boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_departments_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.department_id, q.name, q.description, q.generated)::types.q_get_departments_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_departments_v4_item[]
) as items
FROM (
    SELECT
        d.id AS department_id,
        d.name,
        COALESCE(d.description, '') AS description,
        COALESCE(d.generated, false) AS generated
    FROM departments_resource d
    WHERE d.active = true
      AND d.name IS NOT NULL
      AND d.name != ''
      -- User department filter
      AND (
          COALESCE(array_length(department_ids, 1), 0) = 0
          OR d.id = ANY(department_ids)
      )
      -- Suggest source filter
      AND (
          suggest_source = 'all'
          OR suggest_source IS NULL
          OR (
              suggest_source = 'draft'
              AND draft_id IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM (SELECT departments_id, draft_id FROM agent_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM auth_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM cohort_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM department_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM document_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM eval_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM field_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM model_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM parameter_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM persona_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM profile_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM provider_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM rubric_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM scenario_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM setting_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM simulation_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM suite_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM tool_drafts_departments_connection WHERE active = true
                   UNION ALL SELECT departments_id, draft_id FROM training_drafts_departments_connection WHERE active = true) dc
                  WHERE dc.departments_id = d.id
                    AND dc.draft_id = api_search_departments_v4.draft_id
              )
          )
      )
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (d.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(setting_ids, 1), 0) = 0 OR d.setting_ids && setting_ids)
      -- Search filter
      AND (
          search IS NULL
          OR search = ''
          OR LOWER(d.name) LIKE '%' || LOWER(search) || '%'
          OR LOWER(COALESCE(d.description, '')) LIKE '%' || LOWER(search) || '%'
      )
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT agent OR EXISTS (SELECT 1 FROM agent_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT auth OR EXISTS (SELECT 1 FROM auth_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT cohort OR EXISTS (SELECT 1 FROM cohort_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT department OR EXISTS (SELECT 1 FROM department_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT document OR EXISTS (SELECT 1 FROM document_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT eval OR EXISTS (SELECT 1 FROM eval_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT field OR EXISTS (SELECT 1 FROM field_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT model OR EXISTS (SELECT 1 FROM model_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT parameter OR EXISTS (SELECT 1 FROM parameter_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT persona OR EXISTS (SELECT 1 FROM persona_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT profile OR EXISTS (SELECT 1 FROM profile_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT provider OR EXISTS (SELECT 1 FROM provider_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT rubric OR EXISTS (SELECT 1 FROM rubric_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT scenario OR EXISTS (SELECT 1 FROM scenario_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT setting OR EXISTS (SELECT 1 FROM setting_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT simulation OR EXISTS (SELECT 1 FROM simulation_departments_junction j WHERE j.department_id = d.id AND j.active = true))
      AND (NOT tool OR EXISTS (SELECT 1 FROM tool_departments_junction j WHERE j.department_id = d.id AND j.active = true))
    ORDER BY d.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
