-- Get arg_positions resources by IDs
-- Parameters: ids (uuid[])
-- Returns: items (array of arg position resources)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_arg_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_arg_positions_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_arg_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_arg_positions_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_arg_positions_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_arg_positions_v4_item AS (
    id uuid,
    args_id uuid,
    value integer,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_arg_positions_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_arg_positions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (ap.id, ap.args_id, ap.value, COALESCE(ap.generated, false))::types.q_get_arg_positions_v4_item
        ORDER BY array_position(ids, ap.id)
    ),
    ARRAY[]::types.q_get_arg_positions_v4_item[]
) as items
FROM arg_positions_resource ap
WHERE ap.id = ANY(ids)
  AND ap.active = true;
$$;

