-- Search icons resources with optional context
-- CLEAN PATTERN: Query icons_resource directly
-- Uses draft_id for suggest_source='draft' (efficient drafts_connection lookup)
-- Parameters: search (text), limit_count (int), offset_count (int), draft_id (uuid), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of icon resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_icons_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_icons_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_icons_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    persona boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_icons_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description, q.value, q.generated)::types.q_get_icons_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_icons_v4_item[]
) as items
FROM (
    SELECT i.id, i.name, i.description, i.value, COALESCE(i.generated, false) AS generated
    FROM icons_resource i
    WHERE i.active = true
      AND i.name IS NOT NULL
      AND i.name != ''
      -- Search filter
      AND (search IS NULL OR search = '' OR
           LOWER(i.name) LIKE '%' || LOWER(search) || '%' OR
           LOWER(i.value) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (i.id = ANY(exclude_ids)))
      -- Suggest source filter
      AND (
          suggest_source = 'all'
          OR suggest_source IS NULL
          OR (
              suggest_source = 'draft'
              AND draft_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM (
                      SELECT icons_id, draft_id FROM persona_drafts_icons_connection WHERE active = true
                  ) dc
                  WHERE dc.icon_id = i.id
                    AND dc.draft_id = api_search_icons_v4.draft_id
              )
          )
      )
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT persona OR EXISTS (SELECT 1 FROM persona_icons_junction j WHERE j.icons_id = i.id AND j.active = true))
    ORDER BY i.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
