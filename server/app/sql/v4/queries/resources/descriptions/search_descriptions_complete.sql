-- Search descriptions resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), group_id (uuid, optional), exclude_ids (uuid[])
-- Returns: items (array of description resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_descriptions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_descriptions_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_descriptions_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for description item
CREATE TYPE types.q_get_descriptions_v4_item AS (
    id uuid,
    description text,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_search_descriptions_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    group_id uuid DEFAULT NULL,
    use_recent boolean DEFAULT false,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_descriptions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.description, q.generated)::types.q_get_descriptions_v4_item
        ORDER BY q.description
    ),
    ARRAY[]::types.q_get_descriptions_v4_item[]
) as items
FROM (
    SELECT d.id, d.description, COALESCE(d.generated, false) AS generated, recent.recent_at
    FROM descriptions_resource d
    LEFT JOIN LATERAL (
        SELECT MAX(pd.created_at) AS recent_at
        FROM persona_descriptions_junction pd
        WHERE use_recent = true
          AND pd.description_id = d.id
    ) recent ON true
    WHERE d.description IS NOT NULL
      AND d.description != ''
      AND (search IS NULL OR search = '' OR LOWER(d.description) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (d.id = ANY(exclude_ids)))
      AND (
          COALESCE(d.generated, false) = false
          OR (
              COALESCE(d.generated, false) = true
              AND group_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM view_calls_entry c
                  JOIN view_runs_entry r ON r.id = c.run_id
                  WHERE c.id IN (SELECT call_id FROM descriptions_calls_connection WHERE descriptions_id = d.id)
                    AND r.group_id = group_id
              )
          )
      )
    ORDER BY
        CASE WHEN use_recent THEN recent.recent_at END DESC NULLS LAST,
        d.description
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
