-- Search examples resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), persona_id (uuid, optional), user_department_ids (uuid[]), group_id (uuid, optional), exclude_ids (uuid[])
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
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    group_id uuid DEFAULT NULL,
    use_recent boolean DEFAULT false,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_examples_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH accessible_personas AS (
    SELECT DISTINCT p.id as persona_id
    FROM personas_resource p
    LEFT JOIN persona_departments_junction pd ON pd.persona_id = p.id AND pd.active = true
    WHERE persona_id IS NOT NULL
      AND (
        COALESCE(array_length(user_department_ids, 1), 0) = 0
        OR pd.department_id = ANY(user_department_ids)
        OR NOT EXISTS (SELECT 1 FROM persona_departments_junction pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
      )
),
base AS (
    SELECT e.id, e.example, 0 AS idx, COALESCE(e.generated, false) AS generated, recent.recent_at
    FROM examples_resource e
    LEFT JOIN LATERAL (
        SELECT MAX(pe.created_at) AS recent_at
        FROM persona_examples_junction pe
        WHERE use_recent = true
          AND pe.example_id = e.id
          AND (
              persona_id IS NULL
              OR EXISTS (
                  SELECT 1 FROM accessible_personas ap
                  WHERE ap.persona_id = pe.persona_id
              )
          )
    ) recent ON true
    WHERE e.example IS NOT NULL
      AND e.example != ''
      AND (search IS NULL OR search = '' OR LOWER(e.example) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (e.id = ANY(exclude_ids)))
      AND (
          COALESCE(e.generated, false) = false
          OR (
              COALESCE(e.generated, false) = true
              AND group_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM view_calls_entry c
                  JOIN view_runs_entry r ON r.id = c.run_id
                  WHERE c.id IN (SELECT call_id FROM examples_calls_connection WHERE examples_id = e.id)
                    AND r.group_id = group_id
              )
          )
      )
      AND (
          persona_id IS NULL
          OR EXISTS (
              SELECT 1
              FROM persona_examples_junction pe
              JOIN accessible_personas ap ON ap.persona_id = pe.persona_id
              WHERE pe.example_id = e.id
          )
      )
)
SELECT COALESCE(
    ARRAY_AGG(
        (b.id, b.example, b.idx, b.generated)::types.q_get_examples_v4_item
        ORDER BY b.example
    ),
    ARRAY[]::types.q_get_examples_v4_item[]
) as items
FROM (
    SELECT * FROM base
    ORDER BY
        CASE WHEN use_recent THEN recent_at END DESC NULLS LAST,
        example
    LIMIT limit_count
    OFFSET offset_count
) b;
$$;
