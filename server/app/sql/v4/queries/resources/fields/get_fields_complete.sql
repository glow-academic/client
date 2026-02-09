-- Get fields resources by IDs
-- CLEAN PATTERN: Query fields_resource directly with denormalized name/description/value
-- Parameters: ids (uuid[])
-- Returns: items (array of field resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_fields_v4(%s)', r.sig);
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
        WHERE proname = 'api_search_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_fields_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_fields_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for field item
CREATE TYPE types.q_get_fields_v4_item AS (
    field_id uuid,
    name text,
    description text,
    value text,
    generated boolean,
    conditional_parameter_ids uuid[]
);

-- Create function - query fields_resource directly
CREATE OR REPLACE FUNCTION api_get_fields_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_fields_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            f.id,
            f.name,
            COALESCE(f.description, ''),
            COALESCE(f.value, ''),
            COALESCE(f.generated, false),
            COALESCE(f.conditional_parameter_ids, ARRAY[]::uuid[])
        )::types.q_get_fields_v4_item
        ORDER BY array_position(ids, f.id)
    ),
    ARRAY[]::types.q_get_fields_v4_item[]
) as items
FROM fields_resource f
WHERE f.id = ANY(ids)
  AND f.active = true
  AND f.name IS NOT NULL
  AND f.name != '';
$$;
