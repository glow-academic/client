-- Get model positions by resource IDs
-- Returns model position values
-- Parameters: ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_model_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_model_positions_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_model_positions_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for model position items
CREATE TYPE types.q_get_model_positions_v4_item AS (
    id uuid,
    model_id uuid,
    value integer,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_model_positions_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
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
WHERE mpr.id = ANY(ids)
  AND mpr.active = true;
$$;
