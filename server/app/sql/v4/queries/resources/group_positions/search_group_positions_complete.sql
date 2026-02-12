-- Search group_positions resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of group_positions resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_group_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_group_positions_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_group_positions_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_group_positions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.groups_id, q.eval_id, q.value, q.generated)::types.q_get_group_positions_v4_item
        ORDER BY q.id
    ),
    ARRAY[]::types.q_get_group_positions_v4_item[]
) as items
FROM (
    SELECT r.id, r.groups_id, r.eval_id, r.value, COALESCE(r.generated, false) AS generated
    FROM group_positions_resource r
    WHERE r.active = true
      AND (exclude_ids IS NULL OR NOT (r.id = ANY(exclude_ids)))
    ORDER BY r.id
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
