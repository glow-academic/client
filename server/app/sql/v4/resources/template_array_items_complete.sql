-- Create template_array_items resource
-- Always INSERT operation (preserves all information)
-- Parameters: template_id uuid, schema_field_id uuid, item_template_id uuid, position_value integer
-- Returns: template_array_item_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_template_array_items_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_template_array_items_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_template_array_items_v4(
    template_id uuid, schema_field_id uuid, item_template_id uuid, position_value integer
)
RETURNS TABLE (
    template_array_item_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_template_array_item_id uuid;
BEGIN
    -- INSERT into template_array_items table (always insert, never update)
    INSERT INTO template_array_items(template_id, schema_field_id, item_template_id, "position", active)
    VALUES (template_id, schema_field_id, item_template_id, position_value, true)
    RETURNING id INTO v_template_array_item_id;

    RETURN QUERY SELECT v_template_array_item_id;
END;
$$;