-- Search agents resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of agents resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_agents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_agents_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_agents_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_agents_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description, q.model_id, q.temperature, q.reasoning, q.tool_ids, q.quality, q.voice, q.prompt_id, q.instruction_ids, q.active, q.generated)::types.q_get_agents_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_agents_v4_item[]
) as items
FROM (
    SELECT r.id, r.name, r.description, r.model_id, r.temperature, r.reasoning, COALESCE(r.tool_ids, ARRAY[]::uuid[]) AS tool_ids, r.quality::text AS quality, r.voice, r.prompt_id, COALESCE(r.instruction_ids, ARRAY[]::uuid[]) AS instruction_ids, COALESCE(r.active, true) AS active, COALESCE(r.generated, false) AS generated
    FROM agents_resource r
    WHERE r.active = true
      AND (search IS NULL OR search = '' OR LOWER(r.name) LIKE '%' || LOWER(search) || '%' OR LOWER(r.description) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (r.id = ANY(exclude_ids)))
    ORDER BY r.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
