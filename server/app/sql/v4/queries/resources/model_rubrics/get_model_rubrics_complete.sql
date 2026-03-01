-- Get model rubrics by resource IDs
-- Returns model rubric associations
-- Parameters: ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_model_rubrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_model_rubrics_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop type if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_model_rubrics_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for model rubric items
CREATE TYPE types.q_get_model_rubrics_v4_item AS (
    id uuid,
    model_id uuid,
    rubric_id uuid,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_model_rubrics_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
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
WHERE mrr.id = ANY(ids)
  AND mrr.active = true;
$$;
