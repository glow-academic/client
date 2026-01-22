-- Get schema fields for a resource type
-- Queries resource_outputs_relation → outputs to get the output schema fields

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
        o.name::text as name,
        o.field_type::text as field_type,
        false as required,  -- outputs don't have required field (they're outputs, not inputs)
        0 as position,  -- outputs don't have position field
        ''::text as template  -- templates are handled by args_outputs, not outputs
    FROM resource_outputs_relation ro
    JOIN outputs o ON o.id = ro.outputs_id
    WHERE ro.resource = api_get_resource_schema_fields_v4.resource_type::resources
    ORDER BY o.name;  -- Order by name since position doesn't exist
END;
$$;
