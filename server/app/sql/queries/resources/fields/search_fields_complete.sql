-- Search fields resources with optional context
-- CLEAN PATTERN: Query fields_resource directly with denormalized name/description/value
-- Uses draft_id for suggest_source='draft' (efficient drafts_connection lookup)
-- Parameters: search (text), limit_count (int), offset_count (int), department_ids (uuid[]), draft_id (uuid), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of field resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_fields_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_fields_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    conditional_parameter_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    field boolean DEFAULT false,
    parameter boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_fields_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.field_id, q.name, q.description, q.value, q.generated, q.conditional_parameter_ids)::types.q_get_fields_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_fields_v4_item[]
) as items
FROM (
    SELECT
        f.id AS field_id,
        f.name,
        COALESCE(f.description, '') AS description,
        COALESCE(f.value, '') AS value,
        COALESCE(f.generated, false) AS generated,
        COALESCE(f.conditional_parameter_ids, ARRAY[]::uuid[]) AS conditional_parameter_ids
    FROM fields_resource f
    WHERE f.active = true
      AND f.name IS NOT NULL
      AND f.name != ''
      -- User department filter
      AND (
          COALESCE(array_length(department_ids, 1), 0) = 0
          OR f.department_ids && department_ids
          OR COALESCE(array_length(f.department_ids, 1), 0) = 0
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
                      SELECT fields_id, draft_id FROM parameter_drafts_fields_connection WHERE active = true
                      UNION ALL SELECT fields_id, draft_id FROM chat_drafts_fields_connection WHERE active = true
                  ) dc
                  WHERE dc.fields_id = f.id
                    AND dc.draft_id = api_search_fields_v4.draft_id
              )
          )
      )
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (f.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(conditional_parameter_ids, 1), 0) = 0 OR f.conditional_parameter_ids && conditional_parameter_ids)
      -- Search filter
      AND (
          search IS NULL
          OR search = ''
          OR LOWER(f.name) LIKE '%' || LOWER(search) || '%'
          OR LOWER(COALESCE(f.description, '')) LIKE '%' || LOWER(search) || '%'
      )
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT field OR EXISTS (SELECT 1 FROM field_fields_junction j WHERE j.field_id = f.id AND j.active = true))
      AND (NOT parameter OR EXISTS (SELECT 1 FROM parameter_fields_junction j WHERE j.fields_id = f.id AND j.active = true))
    ORDER BY f.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
