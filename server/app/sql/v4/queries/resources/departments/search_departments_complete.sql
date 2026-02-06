-- Search departments resources with optional context
-- CLEAN PATTERN: Query departments_resource directly with denormalized name/description
-- Uses draft_id for suggest_source='draft' (efficient drafts_connection lookup)
-- Parameters: search (text), limit_count (int), offset_count (int), user_department_ids (uuid[]), draft_id (uuid), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of department resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_departments_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_departments_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_departments_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_departments_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.department_id, q.name, q.description, q.generated)::types.q_get_departments_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_departments_v4_item[]
) as items
FROM (
    SELECT
        d.id AS department_id,
        d.name,
        COALESCE(d.description, '') AS description,
        COALESCE(d.generated, false) AS generated
    FROM departments_resource d
    WHERE d.active = true
      AND d.name IS NOT NULL
      AND d.name != ''
      -- User department filter
      AND (
          COALESCE(array_length(user_department_ids, 1), 0) = 0
          OR d.id = ANY(user_department_ids)
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
                  FROM departments_drafts_connection dc
                  WHERE dc.departments_id = d.id
                    AND dc.draft_id = api_search_departments_v4.draft_id
              )
          )
          OR (
              suggest_source = 'linked'
              AND EXISTS (
                  SELECT 1 FROM persona_departments_junction pd
                  WHERE pd.department_id = d.id
                    AND pd.active = true
              )
          )
      )
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (d.id = ANY(exclude_ids)))
      -- Search filter
      AND (
          search IS NULL
          OR search = ''
          OR LOWER(d.name) LIKE '%' || LOWER(search) || '%'
          OR LOWER(COALESCE(d.description, '')) LIKE '%' || LOWER(search) || '%'
      )
    ORDER BY d.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
