-- Get descriptions resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[]), search (text, optional)
-- Returns: items (array of description resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_descriptions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_descriptions_v4(%s)', r.sig);
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
CREATE OR REPLACE FUNCTION api_get_descriptions_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[],
    search text DEFAULT NULL
)
RETURNS TABLE (
    items types.q_get_descriptions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (d.id, d.description, COALESCE(d.generated, false))::types.q_get_descriptions_v4_item
        ORDER BY array_position(ids, d.id)
    ),
    ARRAY[]::types.q_get_descriptions_v4_item[]
) as items
FROM descriptions_resource d
WHERE d.id = ANY(ids)
  AND d.description IS NOT NULL
  AND d.description != ''
  AND (search IS NULL OR search = '' OR LOWER(d.description) LIKE '%' || LOWER(search) || '%');
$$;
