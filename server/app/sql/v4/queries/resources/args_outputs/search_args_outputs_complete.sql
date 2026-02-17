-- Search args_outputs resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), draft_id (uuid), suggest_source (text), exclude_ids (uuid[]), args_ids (uuid[])
-- Returns: items (array of args_outputs resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_args_outputs_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_args_outputs_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_args_outputs_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Column filters
    args_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    tool boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_args_outputs_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.args_id, q.name, q.template, q.generated)::types.q_get_args_outputs_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_args_outputs_v4_item[]
) as items
FROM (
    SELECT ao.id, ao.args_id, ao.name, ao.template, COALESCE(ao.generated, false) AS generated
    FROM args_outputs_resource ao
    WHERE ao.active = true
      AND ao.name IS NOT NULL
      AND ao.name != ''
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(ao.name) LIKE '%' || LOWER(search) || '%' OR LOWER(ao.template) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (ao.id = ANY(exclude_ids)))
      -- Column filter: args_ids
      AND (COALESCE(array_length(args_ids, 1), 0) = 0 OR ao.args_id = ANY(args_ids))
      -- Suggest source filter
      AND (
          suggest_source = 'all'
          OR suggest_source IS NULL
          OR (
              suggest_source = 'draft'
              AND draft_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM (
                      SELECT args_outputs_id, draft_id FROM tool_drafts_args_outputs_connection WHERE active = true
                  ) dc
                  WHERE dc.args_outputs_id = ao.id
                    AND dc.draft_id = api_search_args_outputs_v4.draft_id
              )
          )
      )
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT tool OR EXISTS (SELECT 1 FROM tool_args_outputs_junction j WHERE j.args_outputs_id = ao.id AND j.active = true))
    ORDER BY ao.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
