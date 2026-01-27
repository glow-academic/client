-- Search instructions resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), group_id (uuid, optional), exclude_ids (uuid[])
-- Returns: items (array of instructions resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_instructions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_instructions_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_instructions_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for instructions item
CREATE TYPE types.q_get_instructions_v4_item AS (
    id uuid,
    template text,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_search_instructions_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    group_id uuid DEFAULT NULL,
    use_recent boolean DEFAULT false,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_instructions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.template, q.generated)::types.q_get_instructions_v4_item
        ORDER BY q.template
    ),
    ARRAY[]::types.q_get_instructions_v4_item[]
) as items
FROM (
    SELECT i.id, i.template, COALESCE(i.generated, false) AS generated, recent.recent_at
    FROM instructions_resource i
    LEFT JOIN LATERAL (
        SELECT MAX(pi.created_at) AS recent_at
        FROM persona_instructions_junction pi
        WHERE use_recent = true
          AND pi.instruction_id = i.id
    ) recent ON true
    WHERE i.active = true
      AND i.template IS NOT NULL
      AND i.template != ''
      AND (search IS NULL OR search = '' OR LOWER(i.template) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (i.id = ANY(exclude_ids)))
      AND (
          COALESCE(i.generated, false) = false
          OR (
              COALESCE(i.generated, false) = true
              AND group_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM view_calls_entry c
                  JOIN view_runs_entry r ON r.id = c.run_id
                  WHERE c.id IN (SELECT call_id FROM instructions_calls_connection WHERE instructions_id = i.id)
                    AND r.group_id = group_id
              )
          )
      )
    ORDER BY
        CASE WHEN use_recent THEN recent.recent_at END DESC NULLS LAST,
        i.template
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
