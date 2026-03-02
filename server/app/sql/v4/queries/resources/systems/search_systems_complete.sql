-- Search systems resources
-- Parameters: search, limit_count, offset_count, exclude_ids
-- Returns: items

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_systems_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_systems_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_search_systems_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    agent_ids uuid[] DEFAULT ARRAY[]::uuid[],
    setting boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_systems_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            q.id,
            q.name,
            q.description,
            q.department_ids,
            q.agent_ids,
            q.active,
            q.generated
        )::types.q_get_systems_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_systems_v4_item[]
) as items
FROM (
    SELECT
        s.id,
        s.name,
        s.description,
        COALESCE(s.department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(s.agent_ids, ARRAY[]::uuid[]) AS agent_ids,
        COALESCE(s.active, true) AS active,
        COALESCE(s.generated, false) AS generated
    FROM systems_resource s
    WHERE s.active = true
      AND (search IS NULL OR search = '' OR LOWER(s.name) LIKE '%' || LOWER(search) || '%' OR LOWER(s.description) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (s.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(department_ids, 1), 0) = 0 OR s.department_ids && department_ids)
      AND (COALESCE(array_length(agent_ids, 1), 0) = 0 OR s.agent_ids && agent_ids)
      AND (
        NOT setting
        OR EXISTS (
            SELECT 1
            FROM setting_systems_junction ssj
            WHERE ssj.systems_id = s.id
              AND ssj.active = true
        )
      )
    ORDER BY s.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
