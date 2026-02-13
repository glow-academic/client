-- Search models resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of model resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_models_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_models_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_models_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    agent boolean DEFAULT false,
    model boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_models_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description, q.value, q.provider_id, q.modality_ids, q.temperature_level_ids, q.reasoning_level_ids, q.quality_ids, q.voice_ids, q.active, q.generated)::types.q_get_models_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_models_v4_item[]
) as items
FROM (
    SELECT m.id, m.name, m.description, m.value, m.provider_id, m.modality_ids, m.temperature_level_ids, m.reasoning_level_ids, m.quality_ids, m.voice_ids, COALESCE(m.active, true) AS active, COALESCE(m.generated, false) AS generated
    FROM models_resource m
    WHERE m.name IS NOT NULL
      AND m.name != ''
      -- Only active models
      AND m.active = true
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(m.name) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (m.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(department_ids, 1), 0) = 0 OR m.department_ids && department_ids)
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT agent OR EXISTS (SELECT 1 FROM agent_models_junction j WHERE j.model_id = m.id AND j.active = true))
      AND (NOT model OR EXISTS (SELECT 1 FROM model_models_junction j WHERE j.model_id = m.id AND j.active = true))
    ORDER BY m.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
