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
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    tool_ids uuid[] DEFAULT ARRAY[]::uuid[],
    instruction_ids uuid[] DEFAULT ARRAY[]::uuid[],
    model_ids uuid[] DEFAULT ARRAY[]::uuid[],
    prompt_ids uuid[] DEFAULT ARRAY[]::uuid[],
    quality text DEFAULT NULL,
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    agent boolean DEFAULT false,
    setting boolean DEFAULT false
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
      AND (COALESCE(array_length(department_ids, 1), 0) = 0 OR r.department_ids && department_ids)
      AND (COALESCE(array_length(tool_ids, 1), 0) = 0 OR r.tool_ids && tool_ids)
      AND (COALESCE(array_length(instruction_ids, 1), 0) = 0 OR r.instruction_ids && instruction_ids)
      AND (COALESCE(array_length(model_ids, 1), 0) = 0 OR r.model_id = ANY(model_ids))
      AND (COALESCE(array_length(prompt_ids, 1), 0) = 0 OR r.prompt_id = ANY(prompt_ids))
      AND (api_search_agents_v4.quality IS NULL OR r.quality::text = api_search_agents_v4.quality)
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT agent OR EXISTS (SELECT 1 FROM agent_agents_junction j WHERE j.agents_id = r.id AND j.active = true))
      AND (NOT setting OR EXISTS (SELECT 1 FROM setting_agents_junction j WHERE j.agents_id = r.id AND j.active = true))
    ORDER BY r.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
