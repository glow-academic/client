-- Get all roles
-- Simple data fetching for profile context 2-pass architecture
-- Parameters: none
-- Returns: items (array of role resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_roles_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_roles_v4(%s)', r.sig);
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
        WHERE proname = 'api_search_roles_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_roles_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_roles_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for role item
CREATE TYPE types.q_get_roles_v4_item AS (
    id uuid,
    role text,
    name text,
    description text,
    icon_value text,
    color_hex text
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_roles_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_roles_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            r.id,
            r.role::text,
            r.name,
            r.description,
            i.value,
            c.hex_code
        )::types.q_get_roles_v4_item
        ORDER BY r.name
    ),
    ARRAY[]::types.q_get_roles_v4_item[]
) as items
FROM roles_resource r
LEFT JOIN icons_resource i ON i.id = r.icon_id
LEFT JOIN colors_resource c ON c.id = r.color_id
WHERE r.active = true
  AND (COALESCE(array_length(ids, 1), 0) = 0 OR r.id = ANY(ids));
$$;
