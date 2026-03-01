-- Search available model flags for models
-- Returns available flags from model_flags_resource
-- Parameters: model_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_model_flags_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_model_flags_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Reuses type from get endpoint: types.q_get_model_flags_v4_item

CREATE OR REPLACE FUNCTION api_search_model_flags_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    model_ids uuid[] DEFAULT ARRAY[]::uuid[],
    flag_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    eval boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_model_flags_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH filtered AS (
    SELECT mfr.id, mfr.model_id, mfr.flag_id, f.name, COALESCE(f.description, '') as description, COALESCE(f.icon, '') as icon, COALESCE(mfr.generated, false) as generated
    FROM model_flags_resource mfr
    JOIN flags_resource f ON f.id = mfr.flag_id AND f.active = true
    WHERE mfr.active = true
      AND (
        COALESCE(array_length(model_ids, 1), 0) = 0
        OR mfr.model_id = ANY(model_ids)
      )
      AND (search IS NULL OR f.name ILIKE '%' || search || '%' OR f.description ILIKE '%' || search || '%')
      AND (COALESCE(array_length(exclude_ids, 1), 0) = 0 OR mfr.id != ALL(exclude_ids))
      AND (COALESCE(array_length(flag_ids, 1), 0) = 0 OR mfr.flag_id = ANY(flag_ids))
      -- Artifact boolean filters
      AND (NOT eval OR EXISTS (SELECT 1 FROM eval_model_flags_junction j WHERE j.model_flag_id = mfr.id AND j.active = true))
    ORDER BY f.name, mfr.model_id
    LIMIT limit_count
    OFFSET offset_count
)
SELECT COALESCE(
    ARRAY_AGG(
        (f.id, f.model_id, f.flag_id, f.name, f.description, f.icon, f.generated)::types.q_get_model_flags_v4_item
        ORDER BY f.name, f.model_id
    ),
    '{}'::types.q_get_model_flags_v4_item[]
) as items
FROM filtered f;
$$;
