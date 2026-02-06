-- Get group_positions resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[])
-- Returns: items (array of group_position resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_group_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_group_positions_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_group_positions_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for group_position item
CREATE TYPE types.q_get_group_positions_v4_item AS (
    id uuid,
    groups_id uuid,
    eval_id uuid,
    value integer,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_group_positions_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_group_positions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (g.id, g.groups_id, g.eval_id, g.value, COALESCE(g.generated, false))::types.q_get_group_positions_v4_item
        ORDER BY array_position(ids, g.id)
    ),
    ARRAY[]::types.q_get_group_positions_v4_item[]
) as items
FROM group_positions_resource g
WHERE g.id = ANY(ids)
  AND g.active = true;
$$;
