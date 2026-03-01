-- Search voices resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of voice resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_voices_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_voices_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_voices_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    agent boolean DEFAULT false,
    model boolean DEFAULT false,
    persona boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_voices_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.voice, q.generated)::types.q_get_voices_v4_item
        ORDER BY q.voice
    ),
    ARRAY[]::types.q_get_voices_v4_item[]
) as items
FROM (
    SELECT v.id, v.voice, COALESCE(v.generated, false) AS generated
    FROM voices_resource v
    WHERE v.active = true
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(v.voice) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (v.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT agent OR EXISTS (SELECT 1 FROM agent_configs_junction acj JOIN config_resource cr ON cr.id = acj.config_id WHERE cr.voice_id = v.id AND acj.active = true AND cr.active = true))
      AND (NOT model OR EXISTS (SELECT 1 FROM model_voices_junction j WHERE j.voice_id = v.id AND j.active = true))
      AND (NOT persona OR EXISTS (SELECT 1 FROM persona_voices_junction j WHERE j.voice_id = v.id AND j.active = true))
    ORDER BY v.voice
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
