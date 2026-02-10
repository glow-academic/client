-- Search texts resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of text resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_texts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_texts_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_texts_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_texts_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            sub.texts_id,
            sub.content,
            sub.generated
        )::types.q_get_texts_v4_item
        ORDER BY sub.created_at DESC
    ),
    ARRAY[]::types.q_get_texts_v4_item[]
) as items
FROM (
    SELECT
        tr.id as texts_id,
        COALESCE(te.content, '') as content,
        COALESCE(tr.generated, false) as generated,
        tr.created_at
    FROM texts_resource tr
    LEFT JOIN texts_texts_connection ttc ON ttc.texts_id = tr.id AND ttc.active = true
    LEFT JOIN texts_entry te ON te.id = ttc.text_id
    WHERE tr.active = true
      AND (exclude_ids IS NULL OR NOT (tr.id = ANY(exclude_ids)))
      AND (search IS NULL OR search = '' OR LOWER(te.content) LIKE '%' || LOWER(search) || '%')
    ORDER BY tr.created_at DESC
    LIMIT limit_count
    OFFSET offset_count
) sub;
$$;
