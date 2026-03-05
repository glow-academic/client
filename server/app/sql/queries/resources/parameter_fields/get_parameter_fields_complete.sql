-- Get parameter fields resources by IDs
-- CLEAN PATTERN: Query parameter_fields_resource with join to fields_resource for name/description
-- Uses denormalized conditional_parameters_id on parameter_fields_resource
-- Parameters: ids (uuid[])
-- Returns: items (array of parameter field resources with parameter_id)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_parameter_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_parameter_fields_v4(%s)', r.sig);
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
        WHERE proname = 'api_search_parameter_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_parameter_fields_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_parameter_fields_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for parameter field item
CREATE TYPE types.q_get_parameter_fields_v4_item AS (
    id uuid,
    field_id uuid,
    parameter_id uuid,
    name text,
    description text,
    generated boolean
);

-- Create function - query parameter_fields_resource with join to fields_resource only
CREATE OR REPLACE FUNCTION api_get_parameter_fields_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_parameter_fields_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            pfr.id,
            pfr.field_id,
            pfr.parameter_id,
            f.name,
            COALESCE(f.description, ''),
            COALESCE(pfr.generated, false)
        )::types.q_get_parameter_fields_v4_item
        ORDER BY array_position(ids, pfr.id)
    ),
    ARRAY[]::types.q_get_parameter_fields_v4_item[]
) as items
FROM parameter_fields_resource pfr
JOIN fields_resource f ON f.id = pfr.field_id
WHERE pfr.id = ANY(ids)
  AND pfr.active = true
  AND f.active = true;
$$;
