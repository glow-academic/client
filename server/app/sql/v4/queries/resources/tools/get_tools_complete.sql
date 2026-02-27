-- Get tools resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[])
-- Returns: items (array of tool resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_tools_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_tools_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop search function if exists (avoids type dependency conflicts)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_tools_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_tools_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_tools_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for tool item
CREATE TYPE types.q_get_tools_v4_item AS (
    id uuid,
    name text,
    description text,
    generated boolean,
    args_ids uuid[],
    args_output_ids uuid[],
    operation text,
    resources text[],
    entries text[],
    artifacts text[]
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_tools_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_tools_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (t.id, t.name, t.description, COALESCE(t.generated, false), COALESCE(t.args_ids, ARRAY[]::uuid[]), COALESCE(t.args_output_ids, ARRAY[]::uuid[]), t.operation, COALESCE(t.resources, ARRAY[]::text[]), COALESCE(t.entries, ARRAY[]::text[]), COALESCE(t.artifacts, ARRAY[]::text[]))::types.q_get_tools_v4_item
        ORDER BY array_position(ids, t.id)
    ),
    ARRAY[]::types.q_get_tools_v4_item[]
) as items
FROM tools_resource t
WHERE t.id = ANY(ids)
  AND t.active = true;
$$;
