-- Get parameter fields resources by IDs
-- CLEAN PATTERN: Query parameter_fields_resource with join to fields_resource for name/description
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
    generated boolean,
    conditional_parameter_id uuid
);

-- Create function - query parameter_fields_resource with join to fields_resource
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
            COALESCE(pfr.generated, false),
            cp_lookup.conditional_parameter_id
        )::types.q_get_parameter_fields_v4_item
        ORDER BY array_position(ids, pfr.id)
    ),
    ARRAY[]::types.q_get_parameter_fields_v4_item[]
) as items
FROM parameter_fields_resource pfr
JOIN fields_resource f ON f.id = pfr.field_id
LEFT JOIN (
    SELECT fcpj.field_id, cpr.parameter_id as conditional_parameter_id
    FROM field_conditional_parameters_junction fcpj
    JOIN conditional_parameters_resource cpr ON cpr.id = fcpj.conditional_parameter_id
    WHERE fcpj.active = true AND cpr.active = true
) cp_lookup ON cp_lookup.field_id = pfr.field_id
WHERE pfr.id = ANY(ids)
  AND pfr.active = true
  AND f.active = true;
$$;
