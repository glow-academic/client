-- Get output schema fields for a tool via tool_templates → schema_templates
-- Used to map template_values (which use output schema field names) to table column names

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_resource_output_schema_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_resource_output_schema_fields_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_resource_output_schema_fields_v4(
    tool_id uuid
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
    FROM tool_templates tt
    JOIN schema_templates st ON st.template_id = tt.template_id
    JOIN schemas s ON s.id = st.schema_id
    JOIN schema_fields sf ON sf.schema_id = s.id
    WHERE tt.tool_id = api_get_resource_output_schema_fields_v4.tool_id
      AND sf.active = true
    ORDER BY sf."position";
END;
$$;
