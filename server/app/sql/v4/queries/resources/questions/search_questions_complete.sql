-- Search questions resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of question resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_questions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_questions_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_questions_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_questions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            q.id,
            q.question_text,
            COALESCE(q.allow_multiple, false),
            COALESCE(q.generated, false)
        )::types.q_get_questions_v4_item
        ORDER BY q.question_text
    ),
    ARRAY[]::types.q_get_questions_v4_item[]
) as items
FROM questions_resource q
WHERE q.active = true
  AND (exclude_ids IS NULL OR NOT (q.id = ANY(exclude_ids)))
  AND (search IS NULL OR search = '' OR LOWER(q.question_text) LIKE '%' || LOWER(search) || '%')
LIMIT limit_count
OFFSET offset_count;
$$;
