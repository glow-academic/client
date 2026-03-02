-- Get systems resources by IDs
-- Parameters: ids (uuid[])
-- Returns: items (array of system resources)

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_systems_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_systems_v4(%s)', r.sig);
    END LOOP;
END $$;

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

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_systems_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_systems_v4_item AS (
    id uuid,
    name text,
    description text,
    department_ids uuid[],
    agent_ids uuid[],
    active boolean,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_systems_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
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
            s.id,
            s.name,
            s.description,
            COALESCE(s.department_ids, ARRAY[]::uuid[]),
            COALESCE(s.agent_ids, ARRAY[]::uuid[]),
            COALESCE(s.active, true),
            COALESCE(s.generated, false)
        )::types.q_get_systems_v4_item
        ORDER BY array_position(ids, s.id)
    ),
    ARRAY[]::types.q_get_systems_v4_item[]
) AS items
FROM systems_resource s
WHERE s.id = ANY(ids)
  AND s.name IS NOT NULL
  AND s.name != '';
$$;
