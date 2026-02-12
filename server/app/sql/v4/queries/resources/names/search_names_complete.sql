-- Search names resources with optional context
-- RULE 6 COMPLIANT: names_resource + names_drafts_connection + {artifact}_names_junction (boolean filters)
-- Parameters: search, limit/offset, draft_id, suggest_source, exclude_ids, artifact booleans
-- Returns: items (array of name resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_names_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_names_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_names_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return names linked to at least one of that artifact type
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
    items types.q_get_names_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.generated)::types.q_get_names_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_names_v4_item[]
) as items
FROM (
    SELECT n.id, n.name, COALESCE(n.generated, false) AS generated
    FROM names_resource n
    WHERE n.name IS NOT NULL
      AND n.name != ''
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(n.name) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (n.id = ANY(exclude_ids)))
      -- Draft filter
      AND (
          suggest_source IS NULL
          OR suggest_source != 'draft'
          OR (
              draft_id IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM names_drafts_connection dc
                  WHERE dc.names_id = n.id
                    AND dc.draft_id = api_search_names_v4.draft_id
              )
          )
      )
      -- Artifact boolean filters (each filters to names linked to at least one of that artifact type)
      AND (NOT agent OR EXISTS (SELECT 1 FROM agent_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT auth OR EXISTS (SELECT 1 FROM auth_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT cohort OR EXISTS (SELECT 1 FROM cohort_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT department OR EXISTS (SELECT 1 FROM department_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT document OR EXISTS (SELECT 1 FROM document_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT eval OR EXISTS (SELECT 1 FROM eval_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT field OR EXISTS (SELECT 1 FROM field_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT model OR EXISTS (SELECT 1 FROM model_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT parameter OR EXISTS (SELECT 1 FROM parameter_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT persona OR EXISTS (SELECT 1 FROM persona_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT profile OR EXISTS (SELECT 1 FROM profile_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT provider OR EXISTS (SELECT 1 FROM provider_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT rubric OR EXISTS (SELECT 1 FROM rubric_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT scenario OR EXISTS (SELECT 1 FROM scenario_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT setting OR EXISTS (SELECT 1 FROM setting_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT simulation OR EXISTS (SELECT 1 FROM simulation_names_junction j WHERE j.name_id = n.id AND j.active = true))
      AND (NOT tool OR EXISTS (SELECT 1 FROM tool_names_junction j WHERE j.name_id = n.id AND j.active = true))
    ORDER BY n.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
