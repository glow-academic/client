-- Search personas resources with optional context
-- CLEAN PATTERN: Query personas_resource directly with denormalized columns
-- Uses draft_id for suggest_source='draft' (efficient drafts_connection lookup)
-- Parameters: search (text), limit_count (int), offset_count (int), user_department_ids (uuid[]), draft_id (uuid), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of persona resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_personas_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_personas_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_personas_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    draft_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_personas_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.persona_id, q.name, q.description, q.color, q.icon, q.image_model, q.instructions, q.examples, q.generated)::types.q_get_personas_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_personas_v4_item[]
) as items
FROM (
    SELECT
        p.id AS persona_id,
        p.name,
        COALESCE(p.description, '') AS description,
        COALESCE(p.color, '') AS color,
        COALESCE(p.icon, '') AS icon,
        false AS image_model,
        COALESCE(p.instructions, '') AS instructions,
        COALESCE(p.examples, ARRAY[]::text[]) AS examples,
        COALESCE(p.generated, false) AS generated
    FROM personas_resource p
    WHERE p.active = true
      AND p.name IS NOT NULL
      AND p.name != ''
      -- Department access: user can see if persona has matching department OR has no departments
      AND (
          COALESCE(array_length(user_department_ids, 1), 0) = 0
          OR p.department_ids && user_department_ids
          OR COALESCE(array_length(p.department_ids, 1), 0) = 0
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
                  FROM personas_drafts_connection dc
                  WHERE dc.personas_id = p.id
                    AND dc.draft_id = api_search_personas_v4.draft_id
              )
          )
          OR (
              suggest_source = 'linked'
              AND EXISTS (
                  SELECT 1 FROM scenario_personas_junction sp
                  WHERE sp.persona_id = p.id
                    AND sp.active = true
              )
          )
      )
      -- Exclude already selected
      AND (exclude_ids IS NULL OR NOT (p.id = ANY(exclude_ids)))
      -- Optional search filter
      AND (search IS NULL OR search = '' OR LOWER(p.name) LIKE '%' || LOWER(search) || '%')
    ORDER BY p.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
