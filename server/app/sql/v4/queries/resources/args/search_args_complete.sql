-- Search args resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), draft_id (uuid), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of arg resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_args_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_args_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_args_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_args_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description, q.field_type, q.required, q.default_value, q.generated)::types.q_get_args_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_args_v4_item[]
) as items
FROM (
    SELECT a.id, a.name, a.description, a.field_type, a.required, a.default_value, COALESCE(a.generated, false) AS generated
    FROM args_resource a
    WHERE a.active = true
      AND a.name IS NOT NULL
      AND a.name != ''
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(a.name) LIKE '%' || LOWER(search) || '%' OR LOWER(a.description) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (a.id = ANY(exclude_ids)))
      -- Suggest source filter
      AND (
          suggest_source = 'all'
          OR suggest_source IS NULL
          OR (
              suggest_source = 'draft'
              AND draft_id IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM args_drafts_connection dc
                  WHERE dc.args_id = a.id
                    AND dc.draft_id = api_search_args_v4.draft_id
              )
          )
          OR (
              suggest_source = 'linked'
              AND EXISTS (
                  SELECT 1 FROM tool_args_junction ta
                  WHERE ta.args_id = a.id
              )
          )
      )
    ORDER BY a.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
