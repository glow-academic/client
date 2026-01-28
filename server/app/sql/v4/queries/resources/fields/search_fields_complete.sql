-- Search fields resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), user_department_ids (uuid[]), group_id (uuid, optional), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of field resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_fields_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_fields_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    user_department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    group_id uuid DEFAULT NULL,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_fields_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.field_id, q.name, q.description, q.generated)::types.q_get_fields_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_fields_v4_item[]
) as items
FROM (
    SELECT
        f.id AS field_id,
        (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1) AS name,
        COALESCE((SELECT d.description FROM field_descriptions_junction fd JOIN descriptions_resource d ON fd.description_id = d.id WHERE fd.field_id = ffj.field_id LIMIT 1), '') AS description,
        COALESCE(f.generated, false) AS generated,
        recent.recent_at
    FROM fields_resource f
    JOIN field_fields_junction ffj ON ffj.fields_id = f.id
    LEFT JOIN LATERAL (
        SELECT MAX(ppfj.created_at) AS recent_at
        FROM persona_parameter_fields_junction ppfj
        JOIN parameter_fields_resource pfr ON pfr.id = ppfj.parameter_field_id
        WHERE pfr.field_id = f.id
          AND (
              ppfj.active = true
              OR (
                  ppfj.generated = true
                  AND f.generated = true
                  AND group_id IS NOT NULL
                  AND EXISTS (
                      SELECT 1 FROM view_calls_entry c
                      JOIN view_runs_entry r ON r.id = c.run_id
                      WHERE c.id IN (SELECT call_id FROM fields_calls_connection WHERE fields_id = f.id)
                        AND r.group_id = group_id
                  )
              )
          )
    ) recent ON (suggest_source IN ('linked', 'recent'))
    WHERE EXISTS (
          SELECT 1 FROM field_flags_junction ff
          JOIN flags_resource fl ON ff.flag_id = fl.id
          WHERE ff.field_id = ffj.field_id
            AND fl.name = 'field_active'
            AND ff.value = true
      )
      AND (
          COALESCE(array_length(user_department_ids, 1), 0) = 0
          OR EXISTS (
              SELECT 1 FROM field_departments_junction fd
              WHERE fd.field_id = ffj.field_id
                AND fd.active = true
                AND fd.department_id = ANY(user_department_ids)
          )
          OR NOT EXISTS (
              SELECT 1 FROM field_departments_junction fd2
              WHERE fd2.field_id = ffj.field_id
                AND fd2.active = true
          )
      )
      AND (
          COALESCE(f.generated, false) = false
          OR (
              COALESCE(f.generated, false) = true
              AND group_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM view_calls_entry c
                  JOIN view_runs_entry r ON r.id = c.run_id
                  WHERE c.id IN (SELECT call_id FROM fields_calls_connection WHERE fields_id = f.id)
                    AND r.group_id = group_id
              )
          )
      )
      AND (
          suggest_source = 'all'
          OR recent.recent_at IS NOT NULL
      )
      AND (exclude_ids IS NULL OR NOT (f.id = ANY(exclude_ids)))
      AND (search IS NULL OR search = '' OR LOWER((SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1)) LIKE '%' || LOWER(search) || '%')
    ORDER BY
        CASE WHEN suggest_source = 'recent' THEN recent.recent_at END DESC NULLS LAST,
        name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
