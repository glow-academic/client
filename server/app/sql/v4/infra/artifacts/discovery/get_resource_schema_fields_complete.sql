-- Get schema fields for a resource type
-- Queries resource_schemas → schemas → schema_fields to get the output schema fields

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_resource_schema_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_resource_schema_fields_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_resource_schema_fields_v4(
    resource_type text
)
RETURNS TABLE (
    name text,
    field_type text,
    required boolean,
    "position" integer,
    template text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sf.name::text as name,
        sf.field_type::text as field_type,
        sf.required as required,
        sf."position" as position,
        sf.template::text as template
    FROM resource_schemas rs
    JOIN schemas s ON s.id = rs.schema_id
    JOIN schema_fields sf ON sf.schema_id = s.id
    WHERE rs.resource = api_get_resource_schema_fields_v4.resource_type::resources
      AND sf.active = true
    ORDER BY sf."position";
END;
$$;
