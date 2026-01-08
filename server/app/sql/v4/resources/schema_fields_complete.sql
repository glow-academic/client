-- Create schema_fields resource
-- Always INSERT operation (preserves all information)
-- Parameters: schema_id uuid, name text, field_type text, required boolean, position_value integer, template text, description text, default_value text
-- Returns: schema_field_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_schema_fields_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_schema_fields_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_schema_fields_v4(
    schema_id uuid, name text, field_type text, required boolean, position_value integer, template text, description text, default_value text
)
RETURNS TABLE (
    schema_field_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_schema_field_id uuid;
BEGIN
    -- INSERT into schema_fields table (always insert, never update)
    INSERT INTO schema_fields(schema_id, name, field_type, required, "position", template, description, default_value, active)
    VALUES (schema_id, name, field_type, required, position_value, template, description, default_value, true)
    RETURNING id INTO v_schema_field_id;

    RETURN QUERY SELECT v_schema_field_id;
END;
$$;