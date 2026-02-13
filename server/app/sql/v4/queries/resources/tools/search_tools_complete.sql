-- Search tools resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of tool resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_tools_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_tools_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_tools_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    agent boolean DEFAULT false,
    tool boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_tools_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description, q.generated)::types.q_get_tools_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_tools_v4_item[]
) as items
FROM (
    SELECT t.id, t.name, t.description, COALESCE(t.generated, false) AS generated
    FROM tools_resource t
    WHERE t.active = true
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(t.name) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (t.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT agent OR EXISTS (SELECT 1 FROM agent_tools_junction j WHERE j.tool_id = t.id AND j.active = true))
      AND (NOT tool OR EXISTS (SELECT 1 FROM tool_tools_junction j WHERE j.tool_id = t.id AND j.active = true))
    ORDER BY t.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
