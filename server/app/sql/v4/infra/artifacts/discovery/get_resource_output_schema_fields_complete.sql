-- Get output schema fields for a tool via tool_args_outputs → args_outputs_resource
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
        ao.name::text as name,
        'string'::text as field_type,  -- args_outputs_resource doesn't have field_type, default to string
        false as required,  -- args_outputs_resource doesn't have required, default to false
        0 as position,  -- args_outputs_resource doesn't have position, default to 0
        COALESCE(ao.template, '')::text as template
    FROM tool_args_outputs tao
    JOIN args_outputs_resource ao ON ao.id = tao.args_outputs_id
    WHERE tao.tool_id = api_get_resource_output_schema_fields_v4.tool_id
      AND ao.active = true
    ORDER BY ao.created_at;  -- Use created_at for ordering since position doesn't exist
END;
$$;
