-- Search modalities resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of modality resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_modalities_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_modalities_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_modalities_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    modality text DEFAULT NULL,
    is_input boolean DEFAULT NULL,
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    model boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_modalities_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.modality, q.is_input, q.generated)::types.q_get_modalities_v4_item
        ORDER BY q.modality ASC
    ),
    ARRAY[]::types.q_get_modalities_v4_item[]
) as items
FROM (
    SELECT m.id, m.modality::text as modality, COALESCE(m.is_input, false) AS is_input, COALESCE(m.generated, false) AS generated
    FROM modalities_resource m
    WHERE m.active = true
      -- Search filter
      AND (search IS NULL OR search = '' OR m.modality::text ILIKE '%' || search || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (m.id = ANY(exclude_ids)))
      AND (api_search_modalities_v4.modality IS NULL OR m.modality::text = api_search_modalities_v4.modality)
      AND (is_input IS NULL OR m.is_input = is_input)
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT model OR EXISTS (SELECT 1 FROM model_modalities_junction j WHERE j.modalities_id = m.id AND j.active = true))
    ORDER BY m.modality ASC
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
