-- Search descriptions resources with optional context
-- CLEAN PATTERN: Query descriptions_resource directly
-- Uses draft_id for suggest_source='draft' (efficient drafts_connection lookup)
-- Parameters: search (text), limit_count (int), offset_count (int), draft_id (uuid), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of description resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_descriptions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_descriptions_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_descriptions_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
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
    provider boolean DEFAULT false,
    rubric boolean DEFAULT false,
    scenario boolean DEFAULT false,
    setting boolean DEFAULT false,
    simulation boolean DEFAULT false,
    tool boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_descriptions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.description, q.generated)::types.q_get_descriptions_v4_item
        ORDER BY q.description
    ),
    ARRAY[]::types.q_get_descriptions_v4_item[]
) as items
FROM (
    SELECT d.id, d.description, COALESCE(d.generated, false) AS generated
    FROM descriptions_resource d
    WHERE d.description IS NOT NULL
      AND d.description != ''
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(d.description) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (d.id = ANY(exclude_ids)))
      -- Suggest source filter
      AND (
          suggest_source = 'all'
          OR suggest_source IS NULL
          OR (
              suggest_source = 'draft'
              AND draft_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM (
                      SELECT descriptions_id, draft_id FROM agent_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM auth_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM cohort_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM department_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM document_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM eval_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM field_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM model_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM parameter_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM persona_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM provider_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM rubric_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM scenario_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM setting_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM simulation_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM invocation_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM tool_drafts_descriptions_connection WHERE active = true
                      UNION ALL SELECT descriptions_id, draft_id FROM chat_drafts_descriptions_connection WHERE active = true
                  ) dc
                  WHERE dc.descriptions_id = d.id
                    AND dc.draft_id = api_search_descriptions_v4.draft_id
              )
          )
      )
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT agent OR EXISTS (SELECT 1 FROM agent_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT auth OR EXISTS (SELECT 1 FROM auth_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT cohort OR EXISTS (SELECT 1 FROM cohort_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT department OR EXISTS (SELECT 1 FROM department_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT document OR EXISTS (SELECT 1 FROM document_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT eval OR EXISTS (SELECT 1 FROM eval_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT field OR EXISTS (SELECT 1 FROM field_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT model OR EXISTS (SELECT 1 FROM model_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT parameter OR EXISTS (SELECT 1 FROM parameter_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT persona OR EXISTS (SELECT 1 FROM persona_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT provider OR EXISTS (SELECT 1 FROM provider_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT rubric OR EXISTS (SELECT 1 FROM rubric_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT scenario OR EXISTS (SELECT 1 FROM scenario_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT setting OR EXISTS (SELECT 1 FROM setting_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT simulation OR EXISTS (SELECT 1 FROM simulation_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
      AND (NOT tool OR EXISTS (SELECT 1 FROM tool_descriptions_junction j WHERE j.description_id = d.id AND j.active = true))
    ORDER BY d.description
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
