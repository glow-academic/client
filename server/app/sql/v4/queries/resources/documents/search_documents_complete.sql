-- Search documents resources with optional context
-- CLEAN PATTERN: Query documents_resource only (no view_uploads_entry join)
-- Uses draft_id for suggest_source='draft' (efficient drafts_connection lookup)
-- Parameters: search (text), limit_count (int), offset_count (int), department_ids (uuid[]), draft_id (uuid), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of document resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_documents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_documents_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_documents_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    document boolean DEFAULT false,
    scenario boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_documents_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.document_id, q.name, q.description, q.generated, q.upload_id, q.html)::types.q_get_documents_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_documents_v4_item[]
) as items
FROM (
    SELECT
        d.id AS document_id,
        d.name,
        COALESCE(d.description, '') AS description,
        COALESCE(d.generated, false) AS generated,
        d.upload_id,
        COALESCE(d.html, false) AS html
    FROM documents_resource d
    WHERE d.active = true
      AND d.name IS NOT NULL
      AND d.name != ''
      -- Department access: user can see if document has matching department OR has no departments
      AND (
          COALESCE(array_length(department_ids, 1), 0) = 0
          OR d.department_ids && department_ids
          OR COALESCE(array_length(d.department_ids, 1), 0) = 0
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
                  FROM documents_drafts_connection dc
                  WHERE dc.documents_id = d.id
                    AND dc.draft_id = api_search_documents_v4.draft_id
              )
          )
      )
      -- Exclude already selected
      AND (exclude_ids IS NULL OR NOT (d.id = ANY(exclude_ids)))
      -- Optional search filter
      AND (
          search IS NULL
          OR search = ''
          OR LOWER(d.name) LIKE '%' || LOWER(search) || '%'
          OR LOWER(COALESCE(d.description, '')) LIKE '%' || LOWER(search) || '%'
      )
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT document OR EXISTS (SELECT 1 FROM document_documents_junction j WHERE j.document_id = d.id AND j.active = true))
      AND (NOT scenario OR EXISTS (SELECT 1 FROM scenario_documents_junction j WHERE j.document_id = d.id AND j.active = true))
    ORDER BY d.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
