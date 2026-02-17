-- Search examples resources with optional context
-- CLEAN PATTERN: Query examples_resource directly
-- Uses draft_id for suggest_source='draft' (efficient drafts_connection lookup)
-- Parameters: search (text), limit_count (int), offset_count (int), persona_id (uuid), department_ids (uuid[]), draft_id (uuid), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of example resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_examples_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_examples_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_examples_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    persona_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    persona boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_examples_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.example, q.idx, q.generated)::types.q_get_examples_v4_item
        ORDER BY q.example
    ),
    ARRAY[]::types.q_get_examples_v4_item[]
) as items
FROM (
    SELECT e.id, e.example, 0 AS idx, COALESCE(e.generated, false) AS generated
    FROM examples_resource e
    WHERE e.example IS NOT NULL
      AND e.example != ''
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(e.example) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (e.id = ANY(exclude_ids)))
      -- Persona filter (if specified, only show examples linked to accessible personas)
      AND (
          persona_id IS NULL
          OR EXISTS (
              SELECT 1 FROM persona_examples_junction pe
              JOIN personas_resource pr ON pr.id = pe.persona_id
              WHERE pe.example_id = e.id
                AND pe.active = true
                AND (
                    COALESCE(array_length(department_ids, 1), 0) = 0
                    OR pr.department_ids && department_ids
                    OR COALESCE(array_length(pr.department_ids, 1), 0) = 0
                )
          )
      )
      -- Suggest source filter
      AND (
          suggest_source = 'all'
          OR suggest_source IS NULL
          OR (
              suggest_source = 'draft'
              AND draft_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM (
                      SELECT examples_id, draft_id FROM persona_drafts_examples_connection WHERE active = true
                  ) dc
                  WHERE dc.examples_id = e.id
                    AND dc.draft_id = api_search_examples_v4.draft_id
              )
          )
      )
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT persona OR EXISTS (SELECT 1 FROM persona_examples_junction j WHERE j.example_id = e.id AND j.active = true))
    ORDER BY e.example
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
