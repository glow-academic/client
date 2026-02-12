-- Search arg_positions resources by args filter
-- Parameters: args_ids (uuid[]), limit_count, offset_count, exclude_ids

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

CREATE OR REPLACE FUNCTION api_search_arg_positions_v4(
    args_ids uuid[] DEFAULT ARRAY[]::uuid[],
    limit_count int DEFAULT 100,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_arg_positions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH scoped AS (
    SELECT
        ap.id,
        ap.args_id,
        ap.value,
        COALESCE(ap.generated, false) AS generated
    FROM arg_positions_resource ap
    WHERE ap.active = true
      AND (COALESCE(array_length(args_ids, 1), 0) = 0 OR ap.args_id = ANY(args_ids))
      AND (COALESCE(array_length(exclude_ids, 1), 0) = 0 OR ap.id <> ALL(exclude_ids))
    ORDER BY ap.value, ap.id
    LIMIT limit_count
    OFFSET offset_count
)
SELECT COALESCE(
    ARRAY_AGG(
        (s.id, s.args_id, s.value, s.generated)::types.q_get_arg_positions_v4_item
        ORDER BY s.value, s.id
    ),
    ARRAY[]::types.q_get_arg_positions_v4_item[]
) AS items
FROM scoped s;
$$;
