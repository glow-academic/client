-- Search available model rubrics for models
-- Returns available rubrics from model_rubrics_resource
-- Parameters: model_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_model_rubrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_model_rubrics_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Reuses type from get endpoint: types.q_get_model_rubrics_v4_item

CREATE OR REPLACE FUNCTION api_search_model_rubrics_v4(
    model_ids uuid[] DEFAULT ARRAY[]::uuid[],
    rubric_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    eval boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_model_rubrics_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT
    COALESCE(
        ARRAY_AGG(
            (mrr.id, mrr.model_id, mrr.rubric_id, COALESCE(mrr.generated, false))::types.q_get_model_rubrics_v4_item
            ORDER BY mrr.model_id
        ),
        '{}'::types.q_get_model_rubrics_v4_item[]
    ) as items
FROM model_rubrics_resource mrr
WHERE mrr.active = true
  AND (
    COALESCE(array_length(model_ids, 1), 0) = 0
    OR mrr.model_id = ANY(model_ids)
  )
  AND (COALESCE(array_length(rubric_ids, 1), 0) = 0 OR mrr.rubric_id = ANY(rubric_ids))
  -- Artifact boolean filters
  AND (NOT eval OR EXISTS (SELECT 1 FROM eval_model_rubrics_junction j WHERE j.model_rubrics_id = mrr.id AND j.active = true));
$$;
