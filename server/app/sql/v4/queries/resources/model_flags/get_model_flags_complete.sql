-- Get model flags by resource IDs
-- Returns model flag details joined with flag information
-- Parameters: ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_model_flags_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_model_flags_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_model_flags_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for model flag items
CREATE TYPE types.q_get_model_flags_v4_item AS (
    id uuid,
    model_id uuid,
    flag_id uuid,
    name text,
    description text,
    icon text,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_model_flags_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_model_flags_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT
    COALESCE(
        ARRAY_AGG(
            (mfr.id, mfr.model_id, mfr.flag_id, f.name, COALESCE(f.description, ''), f.icon, COALESCE(mfr.generated, false))::types.q_get_model_flags_v4_item
            ORDER BY f.name, mfr.model_id
        ),
        '{}'::types.q_get_model_flags_v4_item[]
    ) as items
FROM model_flags_resource mfr
JOIN flags_resource f ON f.id = mfr.flag_id
WHERE mfr.id = ANY(ids)
  AND mfr.active = true;
$$;
