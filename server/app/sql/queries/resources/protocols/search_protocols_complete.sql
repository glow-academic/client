-- Search protocols resources with optional context
-- CLEAN PATTERN: Query protocols_resource directly
-- Uses draft_id for suggest_source='draft' (efficient drafts_connection lookup)
-- Parameters: search (text), limit_count (int), offset_count (int), draft_id (uuid), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of protocol resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_protocols_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_protocols_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_protocols_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    auth boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_protocols_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.value, q.generated)::types.q_get_protocols_v4_item
        ORDER BY q.value
    ),
    ARRAY[]::types.q_get_protocols_v4_item[]
) as items
FROM (
    SELECT p.id, p.value, COALESCE(p.generated, false) AS generated
    FROM protocols_resource p
    WHERE p.value IS NOT NULL
      AND p.value != ''
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(p.value) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (p.id = ANY(exclude_ids)))
      -- Suggest source filter
      AND (
          suggest_source = 'all'
          OR suggest_source IS NULL
          OR (
              suggest_source = 'draft'
              AND draft_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM (
                      SELECT protocols_id, draft_id FROM auth_drafts_protocols_connection WHERE active = true
                  ) dc
                  WHERE dc.protocols_id = p.id
                    AND dc.draft_id = api_search_protocols_v4.draft_id
              )
          )
      )
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT auth OR EXISTS (SELECT 1 FROM auth_protocols_junction j WHERE j.protocols_id = p.id AND j.active = true))
    ORDER BY p.value
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
