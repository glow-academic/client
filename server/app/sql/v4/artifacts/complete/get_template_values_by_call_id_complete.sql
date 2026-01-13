-- Get template values by call_id
-- Returns template values with schema field names and field types

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_template_values_by_call_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_template_values_by_call_id_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_get_template_values_by_call_id_v4(
    call_id uuid
)
RETURNS TABLE (
    name text,
    string_value text,
    number_value numeric,
    boolean_value boolean,
    field_type text
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sf.name::text as name,
        tv.string_value::text as string_value,
        tv.number_value as number_value,
        tv.boolean_value as boolean_value,
        sf.field_type::text as field_type
    FROM template_values_resource tv
    JOIN schema_fields_resource sf ON sf.id = tv.schema_field_id
    WHERE tv.call_id = api_get_template_values_by_call_id_v4.call_id
    ORDER BY sf.position;
END;
$$;
