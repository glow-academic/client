-- Search instructions resources with optional context
-- CLEAN PATTERN: Query instructions_resource directly
-- Uses draft_id for suggest_source='draft' (efficient drafts_connection lookup)
-- Parameters: search (text), limit_count (int), offset_count (int), draft_id (uuid), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of instructions resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_instructions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_instructions_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_instructions_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_instructions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.template, q.generated)::types.q_get_instructions_v4_item
        ORDER BY q.template
    ),
    ARRAY[]::types.q_get_instructions_v4_item[]
) as items
FROM (
    SELECT i.id, i.template, COALESCE(i.generated, false) AS generated
    FROM instructions_resource i
    WHERE i.active = true
      AND i.template IS NOT NULL
      AND i.template != ''
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(i.template) LIKE '%' || LOWER(search) || '%')
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
                  SELECT 1
                  FROM instructions_drafts_connection dc
                  WHERE dc.instructions_id = i.id
                    AND dc.draft_id = api_search_instructions_v4.draft_id
              )
          )
          OR (
              suggest_source = 'linked'
              AND EXISTS (
                  SELECT 1 FROM persona_instructions_junction pi
                  WHERE pi.instruction_id = i.id
                    AND pi.active = true
              )
          )
      )
    ORDER BY i.template
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
