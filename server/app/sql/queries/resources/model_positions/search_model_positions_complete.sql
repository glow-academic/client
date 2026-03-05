-- Search available model positions for models
-- Returns available positions from model_positions_resource
-- Parameters: model_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_model_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_model_positions_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Reuses type from get endpoint: types.q_get_model_positions_v4_item

CREATE OR REPLACE FUNCTION api_search_model_positions_v4(
    model_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    eval boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_model_positions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT
    COALESCE(
        ARRAY_AGG(
            (mpr.id, mpr.model_id, mpr.value, COALESCE(mpr.generated, false))::types.q_get_model_positions_v4_item
            ORDER BY mpr.value, mpr.model_id
        ),
        '{}'::types.q_get_model_positions_v4_item[]
    ) as items
FROM model_positions_resource mpr
WHERE mpr.active = true
  AND (
    COALESCE(array_length(model_ids, 1), 0) = 0
    OR mpr.model_id = ANY(model_ids)
  )
  -- Artifact boolean filters
  AND (NOT eval OR EXISTS (SELECT 1 FROM eval_model_positions_junction j WHERE j.model_positions_id = mpr.id AND j.active = true));
$$;
