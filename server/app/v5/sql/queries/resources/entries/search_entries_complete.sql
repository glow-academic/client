-- Search entries resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of entry resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_entries_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    tool boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_entries_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.entry, q.generated)::types.q_get_entries_v4_item
        ORDER BY q.entry
    ),
    ARRAY[]::types.q_get_entries_v4_item[]
) as items
FROM (
    SELECT b.id, b.entry::text, COALESCE(b.generated, false) AS generated
    FROM entries_resource b
    WHERE b.active = true
      -- Search filter (cast entry to text for LIKE)
      AND (search IS NULL OR search = '' OR LOWER(b.entry::text) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (b.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT tool OR EXISTS (SELECT 1 FROM tool_entries_junction j WHERE j.entry_id = b.id AND j.active = true))
    ORDER BY b.entry::text
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
