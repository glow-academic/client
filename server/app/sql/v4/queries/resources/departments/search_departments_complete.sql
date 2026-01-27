-- Search departments resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), user_department_ids (uuid[]), exclude_ids (uuid[])
-- Returns: items (array of department resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_departments_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_departments_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_departments_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    use_recent boolean DEFAULT false,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_departments_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.department_id, q.name, q.description, q.generated)::types.q_get_departments_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_departments_v4_item[]
) as items
FROM (
    SELECT
        d.id AS department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = ddj.department_id LIMIT 1) AS name,
        COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = ddj.department_id LIMIT 1), '') AS description,
        COALESCE(d.generated, false) AS generated,
        recent.recent_at
    FROM departments_resource d
    JOIN department_departments_junction ddj ON ddj.departments_id = d.id
    JOIN department_artifact da ON da.id = ddj.department_id
    LEFT JOIN LATERAL (
        SELECT MAX(pd.created_at) AS recent_at
        FROM persona_departments_junction pd
        WHERE use_recent = true
          AND pd.department_id = d.id
    ) recent ON true
    WHERE EXISTS (
          SELECT 1 FROM department_flags_junction df
          JOIN flags_resource f ON df.flag_id = f.id
          WHERE df.department_id = da.id
            AND f.name = 'department_active'
            AND df.value = true
      )
      AND (
          COALESCE(array_length(user_department_ids, 1), 0) = 0
          OR d.id = ANY(user_department_ids)
      )
      AND (exclude_ids IS NULL OR NOT (d.id = ANY(exclude_ids)))
      AND (search IS NULL OR search = '' OR LOWER((SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = ddj.department_id LIMIT 1)) LIKE '%' || LOWER(search) || '%')
    ORDER BY
        CASE WHEN use_recent THEN recent.recent_at END DESC NULLS LAST,
        name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
