-- Get output schema fields for a tool via tool_args_outputs_junction → args_outputs_resource
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
    -- tool_id is a tools_resource.id — use denormalized args_output_ids directly
    RETURN QUERY
    SELECT
        ao.name::text as name,
        'string'::text as field_type,
        false as required,
        0 as position,
        COALESCE(ao.template, '')::text as template
    FROM tools_resource tr
    JOIN LATERAL unnest(tr.args_output_ids) AS aoid(id) ON true
    JOIN args_outputs_resource ao ON ao.id = aoid.id AND ao.active = true
    WHERE tr.id = api_get_resource_output_schema_fields_v4.tool_id
      AND tr.active = true
    ORDER BY ao.created_at;
END;
$$;
