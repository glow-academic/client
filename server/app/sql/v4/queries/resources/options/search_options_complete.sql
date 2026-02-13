-- Search options resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of options resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_options_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_options_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_options_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    question_ids uuid[] DEFAULT ARRAY[]::uuid[],
    is_correct boolean DEFAULT NULL,
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    scenario boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_options_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.option_id, q.option_text, q.is_correct, q.generated, q.question_id)::types.q_get_options_v4_item
        ORDER BY q.option_id
    ),
    ARRAY[]::types.q_get_options_v4_item[]
) as items
FROM (
    SELECT
        o.id AS option_id,
        o.option_text,
        COALESCE(o.is_correct, false) AS is_correct,
        COALESCE(o.generated, false) AS generated,
        o.question_id
    FROM options_resource o
    WHERE (search IS NULL OR search = '' OR LOWER(o.option_text) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (o.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(question_ids, 1), 0) = 0 OR o.question_id = ANY(question_ids))
      AND (is_correct IS NULL OR o.is_correct = is_correct)
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT scenario OR EXISTS (SELECT 1 FROM scenario_options_junction j WHERE j.option_id = o.id AND j.active = true))
    ORDER BY o.id
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
