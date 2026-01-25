-- Get colors resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[]), search (text, optional)
-- Returns: items (array of color resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_colors_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_colors_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_colors_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for color item
CREATE TYPE types.q_get_colors_v4_item AS (
    id uuid,
    name text,
    description text,
    hex_code text,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_colors_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[],
    search text DEFAULT NULL
)
RETURNS TABLE (
    items types.q_get_colors_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (c.id, c.name, c.description, c.hex_code, COALESCE(c.generated, false))::types.q_get_colors_v4_item
        ORDER BY array_position(ids, c.id)
    ),
    ARRAY[]::types.q_get_colors_v4_item[]
) as items
FROM colors_resource c
WHERE c.id = ANY(ids)
  AND c.active = true
  AND (search IS NULL OR search = '' OR
       LOWER(c.name) LIKE '%' || LOWER(search) || '%' OR
       LOWER(c.hex_code) LIKE '%' || LOWER(search) || '%');
$$;
