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
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    allow_multiple boolean DEFAULT NULL,
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    scenario boolean DEFAULT false
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
            q.allow_multiple,
            q.generated,
            q.time
        )::types.q_get_questions_v4_item
        ORDER BY q.question_text
    ),
    ARRAY[]::types.q_get_questions_v4_item[]
) as items
FROM (
    SELECT qr.id, qr.question_text, COALESCE(qr.allow_multiple, false) AS allow_multiple, COALESCE(qr.generated, false) AS generated, qr.time
    FROM questions_resource qr
    WHERE qr.active = true
      AND (exclude_ids IS NULL OR NOT (qr.id = ANY(exclude_ids)))
      AND (search IS NULL OR search = '' OR LOWER(qr.question_text) LIKE '%' || LOWER(search) || '%')
      AND (api_search_questions_v4.allow_multiple IS NULL OR qr.allow_multiple = api_search_questions_v4.allow_multiple)
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT scenario OR EXISTS (SELECT 1 FROM scenario_questions_junction j WHERE j.questions_id = qr.id AND j.active = true))
    ORDER BY qr.question_text
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
