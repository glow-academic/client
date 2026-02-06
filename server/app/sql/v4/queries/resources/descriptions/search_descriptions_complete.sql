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
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
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
                  SELECT 1
                  FROM descriptions_drafts_connection dc
                  WHERE dc.descriptions_id = d.id
                    AND dc.draft_id = api_search_descriptions_v4.draft_id
              )
          )
          OR (
              suggest_source = 'linked'
              AND EXISTS (
                  SELECT 1 FROM persona_descriptions_junction pd
                  WHERE pd.description_id = d.id
                    AND pd.active = true
              )
          )
      )
    ORDER BY d.description
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
