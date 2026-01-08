-- Create template_values resource
-- Always INSERT operation (preserves all information)
-- Parameters: template_id uuid, schema_field_id uuid, string_value text, number_value text, boolean_value text
-- Returns: template_value_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_template_values_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_template_values_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_template_values_v4(
    template_id uuid, schema_field_id uuid, string_value text, number_value text, boolean_value text
)
RETURNS TABLE (
    template_value_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_template_value_id uuid;
BEGIN
    -- INSERT into template_values table (always insert, never update)
    INSERT INTO template_values(template_id, schema_field_id, string_value, number_value, boolean_value, active)
    VALUES (template_id, schema_field_id, string_value, number_value, boolean_value, true)
    RETURNING id INTO v_template_value_id;

    RETURN QUERY SELECT v_template_value_id;
END;
$$;