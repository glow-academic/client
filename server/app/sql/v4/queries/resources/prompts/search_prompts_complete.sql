-- Search prompts resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of prompt resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_prompts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_prompts_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_prompts_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    agent boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_prompts_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description, q.system_prompt, q.generated)::types.q_get_prompts_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_prompts_v4_item[]
) as items
FROM (
    SELECT p.id, p.name, p.description, p.system_prompt, COALESCE(p.generated, false) AS generated
    FROM prompts_resource p
    WHERE p.active = true
      AND p.name IS NOT NULL
      AND p.name != ''
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(p.name) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (p.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT agent OR EXISTS (SELECT 1 FROM agent_prompts_junction j WHERE j.prompt_id = p.id AND j.active = true))
    ORDER BY p.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
